import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, FileText, BarChart3, Trash2, Inbox as InboxIcon } from 'lucide-react';
import { db } from '../db';
import type { Capture, MachineNode, VictoryCondition } from '../types';
import { formatDaysSince, NODE_TYPE_CONFIG } from '../types';
import { v4 as uuid } from 'uuid';
import '../styles/inbox.css';

export default function Inbox() {
    const navigate = useNavigate();
    const [captures, setCaptures] = useState<Capture[]>([]);
    const [machines, setMachines] = useState<MachineNode[]>([]);
    const [allNodes, setAllNodes] = useState<MachineNode[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            db.captures.filter(c => !c.processed).sortBy('createdAt').then(arr => arr.reverse()),
            db.nodes.where('parentId').equals('').toArray(),
            db.nodes.toArray(),
        ]).then(([caps, rootMachines, all]) => {
            setCaptures(caps);
            setMachines(rootMachines.sort((a, b) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            ));
            setAllNodes(all);
            setLoading(false);
        });
    }, []);

    // Process capture action handlers
    const dismissCapture = useCallback(async (captureId: string) => {
        await db.captures.update(captureId, { processed: true });
        await db.events.add({ id: uuid(), nodeId: '', eventType: 'capture-processed', timestamp: new Date(), metadata: JSON.stringify({ action: 'dismissed' }) });
        setCaptures(prev => prev.filter(c => c.id !== captureId));
    }, []);

    const makeNote = useCallback(async (captureId: string, nodeId: string, text: string) => {
        const node = await db.nodes.get(nodeId);
        if (!node) return;
        const existingNotes = node.notes || '';
        const newNotes = existingNotes ? `${existingNotes}\n\n📥 ${text}` : `📥 ${text}`;
        await db.nodes.update(nodeId, { notes: newNotes, updatedAt: new Date() });
        await db.captures.update(captureId, { processed: true });
        await db.events.add({ id: uuid(), nodeId, eventType: 'note-updated', timestamp: new Date(), newValue: text });
        await db.events.add({ id: uuid(), nodeId: '', eventType: 'capture-processed', timestamp: new Date(), metadata: JSON.stringify({ action: 'note', targetNodeId: nodeId }) });
        setCaptures(prev => prev.filter(c => c.id !== captureId));
    }, []);

    const makeProblem = useCallback(async (captureId: string, nodeId: string, text: string) => {
        await db.problems.add({
            id: uuid(), machineNodeId: nodeId, title: text, description: '',
            severity: 'medium', status: 'open', diagnosis: '', plan: '',
            createdAt: new Date(), resolvedAt: null,
        });
        await db.captures.update(captureId, { processed: true });
        await db.events.add({ id: uuid(), nodeId, eventType: 'problem-logged', timestamp: new Date(), newValue: text });
        await db.events.add({ id: uuid(), nodeId: '', eventType: 'capture-processed', timestamp: new Date(), metadata: JSON.stringify({ action: 'problem', targetNodeId: nodeId }) });
        setCaptures(prev => prev.filter(c => c.id !== captureId));
    }, []);

    const makeMetric = useCallback(async (captureId: string, vcId: string, nodeId: string, value: string) => {
        await db.victoryConditions.update(vcId, { current: value });
        await db.vcSnapshots.add({
            id: uuid(), victoryConditionId: vcId, machineNodeId: nodeId,
            value, met: false, recordedAt: new Date(),
        });
        await db.captures.update(captureId, { processed: true });
        await db.events.add({ id: uuid(), nodeId, eventType: 'metric-updated', timestamp: new Date(), newValue: value });
        await db.events.add({ id: uuid(), nodeId: '', eventType: 'capture-processed', timestamp: new Date(), metadata: JSON.stringify({ action: 'metric', targetNodeId: nodeId }) });
        setCaptures(prev => prev.filter(c => c.id !== captureId));
    }, []);

    if (loading) {
        return <div className="inbox-page"><div className="inbox-loading">Loading inbox...</div></div>;
    }

    return (
        <div className="inbox-page">
            <div className="inbox-header">
                <div className="inbox-header-left">
                    <button className="wb-back" onClick={() => navigate('/')}><ArrowLeft size={18} /></button>
                    <div>
                        <h1 className="inbox-title">📥 Inbox</h1>
                        <p className="inbox-subtitle">
                            {captures.length} unprocessed capture{captures.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                {captures.length > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={async () => {
                        for (const c of captures) await dismissCapture(c.id);
                    }}>Dismiss All</button>
                )}
            </div>

            <div className="inbox-content">
                {captures.length === 0 ? (
                    <div className="inbox-empty">
                        <InboxIcon size={48} />
                        <h3>Inbox Zero 🎉</h3>
                        <p>All captures have been processed. Use <kbd>⌘.</kbd> to capture thoughts anytime.</p>
                        <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Dashboard</button>
                    </div>
                ) : (
                    <div className="inbox-list">
                        {captures.map(capture => (
                            <CaptureCard
                                key={capture.id}
                                capture={capture}
                                machines={machines}
                                allNodes={allNodes}
                                onDismiss={dismissCapture}
                                onMakeNote={makeNote}
                                onMakeProblem={makeProblem}
                                onMakeMetric={makeMetric}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── CaptureCard ───

function CaptureCard({ capture, machines, allNodes, onDismiss, onMakeNote, onMakeProblem, onMakeMetric }: {
    capture: Capture;
    machines: MachineNode[];
    allNodes: MachineNode[];
    onDismiss: (id: string) => Promise<void>;
    onMakeNote: (id: string, nodeId: string, text: string) => Promise<void>;
    onMakeProblem: (id: string, nodeId: string, text: string) => Promise<void>;
    onMakeMetric: (id: string, vcId: string, nodeId: string, value: string) => Promise<void>;
}) {
    const [selectedMachineId, setSelectedMachineId] = useState(capture.machineId || machines[0]?.id || '');
    const [selectedNodeId, setSelectedNodeId] = useState('');
    const [showMetric, setShowMetric] = useState(false);
    const [vcs, setVcs] = useState<VictoryCondition[]>([]);
    const [selectedVcId, setSelectedVcId] = useState('');
    const [metricValue, setMetricValue] = useState(capture.text);

    const childNodes = allNodes.filter(n => n.parentId === selectedMachineId);
    const targetNodeId = selectedNodeId || selectedMachineId;

    const machineLabel = allNodes.find(n => n.id === capture.machineId)?.label;

    // Load VCs when machine changes
    useEffect(() => {
        if (showMetric && targetNodeId) {
            db.victoryConditions.where('machineNodeId').equals(targetNodeId).toArray().then(v => {
                setVcs(v);
                if (v.length > 0) setSelectedVcId(v[0].id);
            });
        }
    }, [showMetric, targetNodeId]);

    return (
        <div className="capture-card">
            <div className="capture-card-text">{capture.text}</div>
            <div className="capture-card-meta">
                <span>⏱ {formatDaysSince(capture.createdAt)}</span>
                {machineLabel && <span>from <strong>{machineLabel}</strong></span>}
            </div>

            <div className="capture-card-target">
                <select className="capture-select" value={selectedMachineId}
                    onChange={e => { setSelectedMachineId(e.target.value); setSelectedNodeId(''); }}>
                    <option value="">— Select Machine —</option>
                    {machines.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                </select>
                {childNodes.length > 0 && (
                    <select className="capture-select" value={selectedNodeId}
                        onChange={e => setSelectedNodeId(e.target.value)}>
                        <option value="">— Root (machine itself) —</option>
                        {childNodes.map(n => {
                            const tc = NODE_TYPE_CONFIG[n.type];
                            return <option key={n.id} value={n.id}>{tc.icon} {n.label}</option>;
                        })}
                    </select>
                )}
            </div>

            {showMetric && (
                <div className="capture-metric-form">
                    <select className="capture-select" value={selectedVcId}
                        onChange={e => setSelectedVcId(e.target.value)}>
                        <option value="">— Select Victory Condition —</option>
                        {vcs.map(vc => <option key={vc.id} value={vc.id}>{vc.label || '(unnamed)'}</option>)}
                    </select>
                    <input className="capture-metric-input" value={metricValue}
                        onChange={e => setMetricValue(e.target.value)}
                        placeholder="Current value" />
                    <button className="btn btn-primary btn-sm" disabled={!selectedVcId}
                        onClick={() => onMakeMetric(capture.id, selectedVcId, targetNodeId, metricValue)}>
                        Save Metric
                    </button>
                </div>
            )}

            <div className="capture-card-actions">
                <button className="capture-action-btn action-problem" disabled={!targetNodeId}
                    onClick={() => onMakeProblem(capture.id, targetNodeId, capture.text)}>
                    <AlertTriangle size={14} /> Problem
                </button>
                <button className="capture-action-btn action-note" disabled={!targetNodeId}
                    onClick={() => onMakeNote(capture.id, targetNodeId, capture.text)}>
                    <FileText size={14} /> Note
                </button>
                <button className="capture-action-btn action-metric"
                    onClick={() => setShowMetric(!showMetric)}>
                    <BarChart3 size={14} /> Metric
                </button>
                <button className="capture-action-btn action-dismiss"
                    onClick={() => onDismiss(capture.id)}>
                    <Trash2 size={14} /> Dismiss
                </button>
            </div>
        </div>
    );
}
