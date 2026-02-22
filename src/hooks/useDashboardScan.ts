import { useState, useEffect } from 'react';
import { db } from '../db';
import { daysSince, ATTENTION_THRESHOLDS } from '../types';

export interface AttentionItem {
    id: string;
    type: 'stale-problem' | 'stale-node' | 'unmet-vc' | 'blocked-machine' | 'aging-capture';
    title: string;
    subtitle: string;
    nodeId: string;
    machineId: string;
    severity: 'normal' | 'amber' | 'red' | 'critical';
    ageDays: number;
    link: string;
}

function getSeverity(days: number, thresholds: { amber: number; red: number; critical: number }): 'normal' | 'amber' | 'red' | 'critical' {
    if (days >= thresholds.critical) return 'critical';
    if (days >= thresholds.red) return 'red';
    if (days >= thresholds.amber) return 'amber';
    return 'normal';
}

export function useDashboardScan() {
    const [items, setItems] = useState<AttentionItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        runScan().then(results => {
            setItems(results);
            setLoading(false);
        });
    }, []);

    return { items, loading };
}

async function runScan(): Promise<AttentionItem[]> {
    const results: AttentionItem[] = [];

    const [allProblems, allNodes, allVCs, allCaptures, allStatusChanges] = await Promise.all([
        db.problems.toArray(),
        db.nodes.toArray(),
        db.victoryConditions.toArray(),
        db.captures.filter(c => !c.processed).toArray(),
        db.statusChanges.toArray(),
    ]);

    // Build a map of root machine IDs for navigation
    const nodeMap = new Map(allNodes.map(n => [n.id, n]));
    const findRootMachine = (nodeId: string): string => {
        let n = nodeMap.get(nodeId);
        while (n && n.parentId) {
            const parent = nodeMap.get(n.parentId);
            if (!parent) break;
            n = parent;
        }
        return n?.id || nodeId;
    };

    // 1. Stale Problems — open problems sorted by age
    const openProblems = allProblems.filter(p => p.status !== 'resolved');
    for (const p of openProblems) {
        const age = daysSince(p.createdAt);
        const severity = getSeverity(age, ATTENTION_THRESHOLDS.problem);
        if (severity === 'normal') continue; // only show amber+
        const node = nodeMap.get(p.machineNodeId);
        const machineId = findRootMachine(p.machineNodeId);
        results.push({
            id: `prob-${p.id}`,
            type: 'stale-problem',
            title: p.title || 'Untitled problem',
            subtitle: `Open ${age}d on ${node?.label || 'Unknown'}`,
            nodeId: p.machineNodeId,
            machineId,
            severity,
            ageDays: age,
            link: `/machine/${machineId}?parent=${machineId}`,
        });
    }

    // 2. Blocked Machines — how long they've been blocked
    const blockedNodes = allNodes.filter(n => n.statusId === 'blocked');
    for (const node of blockedNodes) {
        // Find when it was set to blocked
        const lastBlocked = allStatusChanges
            .filter(sc => sc.machineNodeId === node.id && sc.toStatusId === 'blocked')
            .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())[0];
        const age = lastBlocked ? daysSince(lastBlocked.changedAt) : daysSince(node.updatedAt);
        const severity = getSeverity(age, ATTENTION_THRESHOLDS.blocked);
        if (severity === 'normal') continue;
        const machineId = findRootMachine(node.id);
        results.push({
            id: `blocked-${node.id}`,
            type: 'blocked-machine',
            title: node.label,
            subtitle: `Blocked for ${age}d`,
            nodeId: node.id,
            machineId,
            severity,
            ageDays: age,
            link: `/machine/${machineId}?parent=${machineId}`,
        });
    }

    // 3. Unmet Victory Conditions
    const unmetVCs = allVCs.filter(vc => !vc.met);
    for (const vc of unmetVCs) {
        const node = nodeMap.get(vc.machineNodeId);
        if (!node) continue;
        const age = daysSince(node.updatedAt);
        const severity = getSeverity(age, ATTENTION_THRESHOLDS.staleness);
        if (severity === 'normal') continue;
        const machineId = findRootMachine(vc.machineNodeId);
        results.push({
            id: `vc-${vc.id}`,
            type: 'unmet-vc',
            title: vc.label || 'Unnamed condition',
            subtitle: `Unmet on ${node.label} — last updated ${age}d ago`,
            nodeId: vc.machineNodeId,
            machineId,
            severity,
            ageDays: age,
            link: `/machine/${machineId}?parent=${machineId}`,
        });
    }

    // 4. Stale Nodes — machines with no recent updates
    const rootNodes = allNodes.filter(n => n.parentId === '' && n.type === 'machine');
    for (const node of rootNodes) {
        const age = daysSince(node.updatedAt);
        const severity = getSeverity(age, ATTENTION_THRESHOLDS.staleness);
        if (severity === 'normal') continue;
        // Don't double-count blocked machines
        if (node.statusId === 'blocked') continue;
        results.push({
            id: `stale-${node.id}`,
            type: 'stale-node',
            title: node.label,
            subtitle: `No activity for ${age}d`,
            nodeId: node.id,
            machineId: node.id,
            severity,
            ageDays: age,
            link: `/machine/${node.id}?parent=${node.id}`,
        });
    }

    // 5. Aging Captures
    const unprocessedCaptures = allCaptures.filter(c => !c.processed);
    if (unprocessedCaptures.length > 0) {
        const oldestAge = Math.max(...unprocessedCaptures.map(c => daysSince(c.createdAt)));
        const severity = getSeverity(oldestAge, ATTENTION_THRESHOLDS.capture);
        if (severity !== 'normal') {
            results.push({
                id: 'captures',
                type: 'aging-capture',
                title: `${unprocessedCaptures.length} unprocessed capture${unprocessedCaptures.length > 1 ? 's' : ''}`,
                subtitle: `Oldest: ${oldestAge}d ago`,
                nodeId: '',
                machineId: '',
                severity,
                ageDays: oldestAge,
                link: '/inbox',
            });
        }
    }

    // Sort: critical first, then by age
    const severityOrder: Record<string, number> = { critical: 0, red: 1, amber: 2, normal: 3 };
    results.sort((a, b) => {
        const so = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
        if (so !== 0) return so;
        return b.ageDays - a.ageDays;
    });

    return results;
}
