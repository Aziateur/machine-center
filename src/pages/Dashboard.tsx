import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, AlertTriangle, Search, Download, Copy, X, ChevronDown, Inbox } from 'lucide-react';
import { db } from '../db';
import type { MachineNode, StatusConfig, Problem } from '../types';
import { NODE_TYPE_CONFIG, daysSince } from '../types';
import { v4 as uuid } from 'uuid';
import { useDashboardScan } from '../hooks/useDashboardScan';
import AttentionPanel from '../components/AttentionPanel';
import '../styles/dashboard.css';

// ─── Types ───

interface MachineProgress {
    total: number;
    running: number;
    blocked: number;
}

interface SearchResult {
    node: MachineNode;
    path: string[];
    rootMachineId: string;
}

// ─── Delete Confirmation Modal ───

function DeleteConfirmModal({ machineName, summary, onConfirm, onCancel }: {
    machineName: string;
    summary: { nodes: number; sops: number; tools: number; skills: number; notes: number; problems: number; edges: number };
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal delete-modal" onClick={e => e.stopPropagation()}>
                <div className="delete-modal-icon">⚠️</div>
                <div className="modal-title" style={{ color: '#ef4444' }}>Delete "{machineName}"?</div>
                <p className="delete-modal-desc">This action is <strong>permanent</strong> and cannot be undone. The following will be deleted:</p>
                <div className="delete-summary">
                    {summary.nodes > 0 && <div className="delete-summary-row"><span>⚙ Machines</span><span>{summary.nodes}</span></div>}
                    {summary.sops > 0 && <div className="delete-summary-row"><span>📋 SOPs</span><span>{summary.sops}</span></div>}
                    {summary.tools > 0 && <div className="delete-summary-row"><span>🔧 Tools</span><span>{summary.tools}</span></div>}
                    {summary.skills > 0 && <div className="delete-summary-row"><span>⭐ Skills</span><span>{summary.skills}</span></div>}
                    {summary.notes > 0 && <div className="delete-summary-row"><span>📝 Notes</span><span>{summary.notes}</span></div>}
                    {summary.problems > 0 && <div className="delete-summary-row"><span>⚠ Problems</span><span>{summary.problems}</span></div>}
                    {summary.edges > 0 && <div className="delete-summary-row"><span>↔ Connections</span><span>{summary.edges}</span></div>}
                </div>
                <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                    <button className="btn btn-danger" onClick={onConfirm}>Delete Everything</button>
                </div>
            </div>
        </div>
    );
}

// ─── Search Panel ───

function SearchPanel({ results, query, onChangeQuery, onSelect, onClose, statuses, statusFilter, onStatusFilter }: {
    results: SearchResult[];
    query: string;
    onChangeQuery: (q: string) => void;
    onSelect: (r: SearchResult) => void;
    onClose: () => void;
    statuses: StatusConfig[];
    statusFilter: string;
    onStatusFilter: (s: string) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    return (
        <div className="modal-overlay search-overlay" onClick={onClose}>
            <div className="search-panel" onClick={e => e.stopPropagation()}>
                <div className="search-header">
                    <Search size={18} />
                    <input
                        ref={inputRef}
                        className="search-input"
                        value={query}
                        onChange={e => onChangeQuery(e.target.value)}
                        placeholder="Search all nodes across all machines..."
                    />
                    <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
                </div>

                {/* Status filter */}
                <div className="search-filters">
                    <button
                        className={`search-filter-btn ${statusFilter === '' ? 'active' : ''}`}
                        onClick={() => onStatusFilter('')}
                    >All</button>
                    {statuses.map(s => (
                        <button
                            key={s.id}
                            className={`search-filter-btn ${statusFilter === s.id ? 'active' : ''}`}
                            onClick={() => onStatusFilter(s.id)}
                            style={statusFilter === s.id ? { borderColor: s.color, color: s.color } : {}}
                        >
                            {s.icon} {s.label}
                        </button>
                    ))}
                </div>

                <div className="search-results">
                    {results.length === 0 && query.length > 0 && (
                        <div className="search-empty">No results found</div>
                    )}
                    {results.length === 0 && query.length === 0 && statusFilter === '' && (
                        <div className="search-empty">Type to search across all machines, SOPs, tools, skills, and notes</div>
                    )}
                    {results.map(r => {
                        const tc = NODE_TYPE_CONFIG[r.node.type] || NODE_TYPE_CONFIG.machine;
                        return (
                            <div key={r.node.id} className="search-result-row" onClick={() => onSelect(r)}>
                                <div className="search-result-badge" style={{ background: `${tc.color}20`, color: tc.color }}>
                                    {tc.icon}
                                </div>
                                <div className="search-result-info">
                                    <div className="search-result-name">{r.node.label}</div>
                                    <div className="search-result-path">{r.path.join(' › ')}</div>
                                </div>
                                {r.node.goal && <div className="search-result-goal">🎯 {r.node.goal}</div>}
                            </div>
                        );
                    })}
                    {results.length > 0 && (
                        <div className="search-count">{results.length} result{results.length !== 1 ? 's' : ''}</div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Dashboard ───

export default function Dashboard() {
    const navigate = useNavigate();
    const [machines, setMachines] = useState<MachineNode[]>([]);
    const [statuses, setStatuses] = useState<StatusConfig[]>([]);
    const [problems, setProblems] = useState<Problem[]>([]);
    const [progress, setProgress] = useState<Record<string, MachineProgress>>({});
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newGoal, setNewGoal] = useState('');

    // Search
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [allNodes, setAllNodes] = useState<MachineNode[]>([]);
    const [statusFilter, setStatusFilter] = useState('');

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<MachineNode | null>(null);
    const [deleteSummary, setDeleteSummary] = useState<{ nodes: number; sops: number; tools: number; skills: number; notes: number; problems: number; edges: number } | null>(null);

    // Loop speed
    const [loopSpeed, setLoopSpeed] = useState<number | null>(null);

    // Inbox count
    const [inboxCount, setInboxCount] = useState(0);

    // Phase 5: Active Layer
    const { items: attentionItems } = useDashboardScan();
    const [dismissedAttention, setDismissedAttention] = useState(false);

    useEffect(() => {
        Promise.all([
            db.nodes.where('parentId').equals('').toArray(),
            db.statuses.orderBy('order').toArray(),
            db.problems.toArray(),
            db.nodes.toArray(),
            db.captures.filter(c => !c.processed).count(),
        ]).then(async ([rootNodes, allStatuses, allProblems, everyNode, unprocessed]) => {
            setMachines(rootNodes);
            setStatuses(allStatuses);
            setProblems(allProblems);
            setAllNodes(everyNode);
            setInboxCount(unprocessed);

            // Compute sub-machine progress
            const prog: Record<string, MachineProgress> = {};
            for (const machine of rootNodes) {
                const children = await db.nodes.where('parentId').equals(machine.id).toArray();
                prog[machine.id] = {
                    total: children.length,
                    running: children.filter(c => c.statusId === 'running' || c.statusId === 'optimizing').length,
                    blocked: children.filter(c => c.statusId === 'blocked').length,
                };
            }
            setProgress(prog);

            // Compute loop speed (average days from problem created to resolved)
            const resolved = allProblems.filter(p => p.status === 'resolved' && p.resolvedAt);
            if (resolved.length > 0) {
                const totalDays = resolved.reduce((sum, p) => {
                    const days = daysSince(p.createdAt) - daysSince(p.resolvedAt!);
                    return sum + Math.abs(days);
                }, 0);
                setLoopSpeed(Math.round(totalDays / resolved.length));
            }
        });
    }, []);

    // ─── Search logic ───

    useEffect(() => {
        if (!showSearch) return;
        const q = searchQuery.toLowerCase().trim();
        let filtered = allNodes;

        // Apply status filter
        if (statusFilter) {
            filtered = filtered.filter(n => n.statusId === statusFilter);
        }

        // Apply text query
        if (q) {
            filtered = filtered.filter(n =>
                n.label.toLowerCase().includes(q) ||
                n.goal?.toLowerCase().includes(q) ||
                n.description?.toLowerCase().includes(q) ||
                n.notes?.toLowerCase().includes(q) ||
                n.bottleneck?.toLowerCase().includes(q)
            );
        }

        // Don't show all nodes when no query and no filter
        if (!q && !statusFilter) {
            setSearchResults([]);
            return;
        }

        // Build path for each result
        const results: SearchResult[] = filtered.map(node => {
            const path: string[] = [];
            let current: MachineNode | undefined = node;
            while (current) {
                path.unshift(current.label);
                current = allNodes.find(n => n.id === current!.parentId);
            }
            // Find root machine id
            let rootId = node.id;
            let walk: MachineNode | undefined = node;
            while (walk && walk.parentId !== '') {
                rootId = walk.parentId;
                walk = allNodes.find(n => n.id === walk!.parentId);
            }
            return { node, path, rootMachineId: rootId };
        });

        setSearchResults(results.slice(0, 50));
    }, [searchQuery, statusFilter, showSearch, allNodes]);

    const handleSearchSelect = (r: SearchResult) => {
        setShowSearch(false);
        // Navigate to the root machine, then to parent canvas
        if (r.node.parentId === '') {
            navigate(`/machine/${r.node.id}`);
        } else {
            navigate(`/machine/${r.rootMachineId}?parent=${r.node.parentId}&select=${r.node.id}`);
        }
    };

    // ─── Keyboard shortcut ───

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowSearch(prev => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // ─── Create ───

    const handleCreate = useCallback(async () => {
        if (!newName.trim()) return;
        const machine: MachineNode = {
            id: uuid(), parentId: '', type: 'machine',
            label: newName.trim(), description: '',
            statusId: 'not-built', position: { x: 0, y: 0 },
            goal: newGoal.trim(), bottleneck: '',
            notes: '', steps: [], toolUrl: '', proficiency: null,
            hasChildren: true, createdAt: new Date(), updatedAt: new Date(),
        };
        await db.nodes.add(machine);
        setMachines(prev => [...prev, machine]);
        setAllNodes(prev => [...prev, machine]);
        setNewName(''); setNewGoal('');
        setShowCreate(false);
    }, [newName, newGoal]);

    // ─── Delete with confirmation ───

    const prepareDelete = async (machine: MachineNode, e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();

        // Count everything recursively
        const countRecursive = async (nodeId: string): Promise<{ nodes: number; sops: number; tools: number; skills: number; notes: number; problems: number; edges: number }> => {
            const children = await db.nodes.where('parentId').equals(nodeId).toArray();
            const edgeCount = await db.edges.where('parentId').equals(nodeId).count();
            const probCount = await db.problems.where('machineNodeId').equals(nodeId).count();

            let totals = {
                nodes: 0, sops: 0, tools: 0, skills: 0, notes: 0,
                problems: probCount, edges: edgeCount,
            };

            for (const child of children) {
                if (child.type === 'machine') totals.nodes++;
                else if (child.type === 'sop') totals.sops++;
                else if (child.type === 'tool') totals.tools++;
                else if (child.type === 'skill') totals.skills++;
                else if (child.type === 'note') totals.notes++;

                const childTotals = await countRecursive(child.id);
                totals.nodes += childTotals.nodes;
                totals.sops += childTotals.sops;
                totals.tools += childTotals.tools;
                totals.skills += childTotals.skills;
                totals.notes += childTotals.notes;
                totals.problems += childTotals.problems;
                totals.edges += childTotals.edges;
            }
            return totals;
        };

        const summary = await countRecursive(machine.id);
        // Count the root machine itself
        summary.nodes += 1;
        setDeleteTarget(machine);
        setDeleteSummary(summary);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const id = deleteTarget.id;

        async function deleteRecursive(nodeId: string) {
            const children = await db.nodes.where('parentId').equals(nodeId).toArray();
            for (const child of children) await deleteRecursive(child.id);
            await db.edges.where('parentId').equals(nodeId).delete();
            await db.problems.where('machineNodeId').equals(nodeId).delete();
            await db.victoryConditions.where('machineNodeId').equals(nodeId).delete();
            await db.statusChanges.where('machineNodeId').equals(nodeId).delete();
            await db.nodes.delete(nodeId);
        }
        await deleteRecursive(id);
        setMachines(prev => prev.filter(m => m.id !== id));
        setAllNodes(prev => prev.filter(n => n.id !== id && n.parentId !== id));
        setDeleteTarget(null);
        setDeleteSummary(null);
    };

    // ─── Duplicate ───

    const duplicateMachine = async (machine: MachineNode, e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();

        const idMap = new Map<string, string>();

        async function cloneRecursive(nodeId: string, newParentId: string) {
            const node = await db.nodes.get(nodeId);
            if (!node) return;

            const newId = uuid();
            idMap.set(nodeId, newId);

            const clone: MachineNode = {
                ...node,
                id: newId,
                parentId: newParentId,
                label: newParentId === '' ? `${node.label} (Copy)` : node.label,
                createdAt: new Date(),
                updatedAt: new Date(),
                steps: node.steps.map(s => ({ ...s, id: uuid(), done: false })),
            };
            await db.nodes.add(clone);

            // Clone children
            const children = await db.nodes.where('parentId').equals(nodeId).toArray();
            for (const child of children) {
                await cloneRecursive(child.id, newId);
            }

            // Clone edges within this level
            const edges = await db.edges.where('parentId').equals(nodeId).toArray();
            for (const edge of edges) {
                await db.edges.add({
                    ...edge,
                    id: uuid(),
                    parentId: newId,
                    source: idMap.get(edge.source) || edge.source,
                    target: idMap.get(edge.target) || edge.target,
                });
            }

            // Clone victory conditions
            const vcs = await db.victoryConditions.where('machineNodeId').equals(nodeId).toArray();
            for (const vc of vcs) {
                await db.victoryConditions.add({
                    ...vc,
                    id: uuid(),
                    machineNodeId: newId,
                });
            }
        }

        await cloneRecursive(machine.id, '');
        // Refresh
        const rootNodes = await db.nodes.where('parentId').equals('').toArray();
        setMachines(rootNodes);
        const all = await db.nodes.toArray();
        setAllNodes(all);
    };

    // ─── Export ───

    const handleExport = async () => {
        const nodes = await db.nodes.toArray();
        const edges = await db.edges.toArray();
        const problems = await db.problems.toArray();
        const victoryConditions = await db.victoryConditions.toArray();
        const vcSnapshots = await db.vcSnapshots.toArray();
        const statusChanges = await db.statusChanges.toArray();
        const captures = await db.captures.toArray();
        const events = await db.events.toArray();
        const data = {
            exportedAt: new Date().toISOString(),
            version: 7,
            summary: {
                nodes: nodes.length,
                edges: edges.length,
                problems: problems.length,
                victoryConditions: victoryConditions.length,
                captures: captures.length,
                events: events.length,
            },
            nodes,
            edges,
            statuses: await db.statuses.toArray(),
            problems,
            levers: await db.levers.toArray(),
            principles: await db.principles.toArray(),
            victoryConditions,
            vcSnapshots,
            statusChanges,
            captures,
            events,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `machine-center-backup-${ts}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ─── Import ───

    const handleImport = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const text = await file.text();
            try {
                const data = JSON.parse(text);
                if (!data.nodes || !data.edges) {
                    alert('Invalid backup file');
                    return;
                }
                // Clear existing data
                await db.nodes.clear();
                await db.edges.clear();
                await db.problems.clear();
                await db.victoryConditions.clear();
                await db.vcSnapshots.clear();
                await db.statusChanges.clear();
                await db.levers.clear();
                await db.principles.clear();
                await db.captures.clear();
                await db.events.clear();
                // Import
                if (data.nodes.length) await db.nodes.bulkAdd(data.nodes);
                if (data.edges.length) await db.edges.bulkAdd(data.edges);
                if (data.problems?.length) await db.problems.bulkAdd(data.problems);
                if (data.victoryConditions?.length) await db.victoryConditions.bulkAdd(data.victoryConditions);
                if (data.vcSnapshots?.length) await db.vcSnapshots.bulkAdd(data.vcSnapshots);
                if (data.statusChanges?.length) await db.statusChanges.bulkAdd(data.statusChanges);
                if (data.levers?.length) await db.levers.bulkAdd(data.levers);
                if (data.principles?.length) await db.principles.bulkAdd(data.principles);
                if (data.captures?.length) await db.captures.bulkAdd(data.captures);
                if (data.events?.length) await db.events.bulkAdd(data.events);
                // Refresh
                window.location.reload();
            } catch (err) {
                alert('Failed to import: ' + (err as Error).message);
            }
        };
        input.click();
    };

    // ─── Goal editing ───

    const [editingGoal, setEditingGoal] = useState<string | null>(null);
    const [goalValue, setGoalValue] = useState('');

    const startEditGoal = (id: string, currentGoal: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingGoal(id);
        setGoalValue(currentGoal);
    };

    const saveGoal = async () => {
        if (!editingGoal) return;
        await db.nodes.update(editingGoal, { goal: goalValue, updatedAt: new Date() });
        setMachines(prev => prev.map(m => m.id === editingGoal ? { ...m, goal: goalValue } : m));
        setEditingGoal(null);
    };

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <div className="dashboard-header-left">
                    <div className="dashboard-logo">
                        <div className="logo-icon">⚙</div>
                        <div>
                            <h1 className="dashboard-title">Machine Center</h1>
                            <p className="dashboard-subtitle">Design, operate, and evolve your machines</p>
                        </div>
                    </div>
                </div>
                <div className="dashboard-header-right">
                    {loopSpeed !== null && (
                        <div className="loop-speed-badge" title="Average days from problem logged to resolved">
                            🔄 Loop: {loopSpeed}d avg
                        </div>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/inbox')} title="Inbox">
                        <Inbox size={16} /> Inbox
                        {inboxCount > 0 && <span className="inbox-header-badge">{inboxCount}</span>}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowSearch(true)} title="Search (⌘K)">
                        <Search size={16} /> Search
                    </button>
                    <div className="dashboard-dropdown">
                        <button className="btn btn-ghost btn-sm">
                            <Download size={16} /> Data <ChevronDown size={12} />
                        </button>
                        <div className="dashboard-dropdown-content">
                            <button onClick={handleExport}>📥 Export Backup (JSON)</button>
                            <button onClick={handleImport}>📤 Import Backup</button>
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        <Plus size={16} /> New Machine
                    </button>
                </div>
            </div>

            {/* Phase 5: Active Layer — Attention Panel */}
            {attentionItems.length > 0 && !dismissedAttention && (
                <div style={{ padding: '0 32px', paddingTop: '20px' }}>
                    <AttentionPanel items={attentionItems} onDismissAll={() => setDismissedAttention(true)} />
                </div>
            )}

            <div className="dashboard-grid">
                {machines.map(machine => {
                    const status = statuses.find(s => s.id === machine.statusId);
                    const machineProblems = problems.filter(
                        p => p.machineNodeId === machine.id && p.status !== 'resolved'
                    );
                    const prog = progress[machine.id];

                    return (
                        <div
                            key={machine.id}
                            className="machine-card"
                            onClick={(e) => {
                                if ((e.target as HTMLElement).closest('.machine-card-delete')) return;
                                if ((e.target as HTMLElement).closest('.machine-card-duplicate')) return;
                                if ((e.target as HTMLElement).closest('.goal-edit-area')) return;
                                navigate(`/machine/${machine.id}`);
                            }}
                            style={{ '--card-accent': status?.color ?? '#6b7280' } as React.CSSProperties}
                        >
                            <div className="machine-card-header">
                                <span className="machine-card-status">
                                    {status?.icon} {status?.label}
                                </span>
                                <div className="machine-card-actions">
                                    <button
                                        className="machine-card-duplicate"
                                        onClick={(e) => duplicateMachine(machine, e)}
                                        title="Duplicate machine"
                                    ><Copy size={13} /></button>
                                    <button
                                        className="machine-card-delete"
                                        onClick={(e) => prepareDelete(machine, e)}
                                        title="Delete machine"
                                    >×</button>
                                </div>
                            </div>

                            <h3 className="machine-card-name">{machine.label}</h3>

                            <div className="goal-edit-area" onClick={e => e.stopPropagation()}>
                                {editingGoal === machine.id ? (
                                    <input
                                        className="machine-card-goal-input"
                                        value={goalValue}
                                        onChange={e => setGoalValue(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setEditingGoal(null); }}
                                        onBlur={saveGoal}
                                        placeholder="What's the goal?"
                                        autoFocus
                                    />
                                ) : machine.goal ? (
                                    <div className="machine-card-goal"
                                        onClick={e => startEditGoal(machine.id, machine.goal, e)}>
                                        🎯 {machine.goal}
                                    </div>
                                ) : (
                                    <div className="machine-card-prompt"
                                        onClick={e => startEditGoal(machine.id, '', e)}>
                                        <AlertTriangle size={13} /> Click to set goal
                                    </div>
                                )}
                            </div>

                            {prog && prog.total > 0 && (
                                <div className="machine-card-progress">
                                    <div className="progress-bar-track">
                                        <div className="progress-bar-fill"
                                            style={{ width: `${Math.round((prog.running / prog.total) * 100)}%` }} />
                                    </div>
                                    <span className="progress-label">
                                        {prog.running}/{prog.total} running
                                        {prog.blocked > 0 && <span className="progress-blocked"> · {prog.blocked} blocked</span>}
                                    </span>
                                </div>
                            )}

                            {machineProblems.length > 0 && (
                                <div className="machine-card-problems">
                                    <AlertTriangle size={13} />
                                    {machineProblems.length} problem{machineProblems.length > 1 ? 's' : ''}
                                </div>
                            )}

                            <div className="machine-card-footer">
                                <span className="machine-card-date">
                                    {new Date(machine.updatedAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    );
                })}

                <div className="machine-card new-card" onClick={() => setShowCreate(true)}>
                    <Plus size={28} />
                    <span>New Machine</span>
                </div>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-title">Create New Machine</div>
                        <div className="form-group">
                            <label className="form-label">Machine name</label>
                            <input className="input" value={newName} onChange={e => setNewName(e.target.value)}
                                placeholder="e.g., Sales Machine, Content Machine..." autoFocus />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Goal <span className="form-hint">(what should it produce?)</span></label>
                            <input className="input" value={newGoal} onChange={e => setNewGoal(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                placeholder="e.g., 100 qualified leads/month, $50k MRR..." />
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleCreate}>Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {deleteTarget && deleteSummary && (
                <DeleteConfirmModal
                    machineName={deleteTarget.label}
                    summary={deleteSummary}
                    onConfirm={confirmDelete}
                    onCancel={() => { setDeleteTarget(null); setDeleteSummary(null); }}
                />
            )}

            {/* Search */}
            {showSearch && (
                <SearchPanel
                    results={searchResults}
                    query={searchQuery}
                    onChangeQuery={setSearchQuery}
                    onSelect={handleSearchSelect}
                    onClose={() => { setShowSearch(false); setSearchQuery(''); setStatusFilter(''); }}
                    statuses={statuses}
                    statusFilter={statusFilter}
                    onStatusFilter={setStatusFilter}
                />
            )}
        </div>
    );
}
