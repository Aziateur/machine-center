import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
    useReactFlow, MarkerType,
    type Connection, type Node, type Edge, type NodeChange, type EdgeChange,
    BackgroundVariant, Panel,
    applyNodeChanges, applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    ArrowLeft, Plus, X, Pencil, Trash2,
    Check, XCircle, ExternalLink, GripVertical,
} from 'lucide-react';
import { nodeTypes } from '../components/nodes/FlowNodes';
import type { MachineNodeData } from '../components/nodes/FlowNodes';
import { db } from '../db';
import type {
    MachineNode, MachineEdge, StatusConfig, Problem, VictoryCondition,
    BreadcrumbSegment, NodeType, SopStep, VCSnapshot, MachineEvent,
} from '../types';
import {
    NODE_TYPE_CONFIG, PROFICIENCY_LEVELS, EDGE_RELATIONSHIPS,
    formatDaysSince, PROBLEM_SEVERITY_ORDER,
} from '../types';
import { v4 as uuid } from 'uuid';
import Collapsible from '../components/Collapsible';
import '../styles/whiteboard.css';

// ─── Helpers ───

function toFlowNode(
    n: MachineNode, statuses: StatusConfig[],
    problemCounts: Record<string, number>,
    callbacks: { onDrillDown: (id: string) => void; onSelect: (id: string) => void }
): Node {
    const status = statuses.find(s => s.id === n.statusId) ?? statuses[0];
    const stepsDone = (n.steps ?? []).filter(s => s.done).length;
    return {
        id: n.id, type: 'machine', position: n.position,
        data: {
            label: n.label,
            nodeType: n.type || 'machine',
            statusLabel: status?.label ?? 'Unknown',
            statusColor: status?.color ?? '#6b7280',
            statusIcon: status?.icon ?? '⚪',
            goal: n.goal,
            bottleneck: n.bottleneck || '',
            notes: n.notes || '',
            hasChildren: n.hasChildren,
            problemCount: problemCounts[n.id] ?? 0,
            missingGoal: n.type === 'machine' && !n.goal,
            stepsTotal: (n.steps ?? []).length,
            stepsDone,
            toolUrl: n.toolUrl || '',
            proficiency: n.proficiency ?? null,
            ...callbacks,
        } satisfies MachineNodeData,
    };
}

function toFlowEdge(e: MachineEdge): Edge {
    const rel = EDGE_RELATIONSHIPS.find(r => r.value === e.relationship);
    const color = rel?.color ?? '#64748b';
    const edgeLabel = e.label || rel?.label || '';
    return {
        id: e.id, source: e.source, target: e.target,
        label: edgeLabel || undefined,
        type: 'smoothstep', animated: true,
        style: { strokeWidth: 2.5, stroke: color },
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color },
        labelStyle: { fill: color, fontWeight: 600, fontSize: 11 },
        labelBgStyle: { fill: '#1a1a2e', fillOpacity: 0.9 },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 4,
    };
}

function defaultNodeFields(type: NodeType): Partial<MachineNode> {
    return {
        type, description: '', statusId: 'not-built',
        goal: '', bottleneck: '', notes: '', steps: [], toolUrl: '',
        proficiency: null, hasChildren: false,
    };
}

// ─── Shortcut Overlay ───

function ShortcutOverlay({ statuses, onSelect, onClose }: {
    statuses: StatusConfig[]; onSelect: (id: string) => void; onClose: () => void;
}) {
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            const n = parseInt(e.key);
            if (n >= 1 && n <= statuses.length) onSelect(statuses[n - 1].id);
            else onClose();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [statuses, onSelect, onClose]);
    return (
        <div className="shortcut-overlay" onClick={onClose}>
            <div className="shortcut-palette" onClick={e => e.stopPropagation()}>
                <div className="shortcut-palette-title">Set Status</div>
                {statuses.map((s, i) => (
                    <button key={s.id} className="shortcut-option" onClick={() => onSelect(s.id)}>
                        <span className="shortcut-key">{i + 1}</span>
                        <span className="shortcut-icon">{s.icon}</span>
                        <span className="shortcut-label">{s.label}</span>
                    </button>
                ))}
                <div className="shortcut-hint">Press number or Esc</div>
            </div>
        </div>
    );
}

// ─── Add Node Menu ───

function AddNodeMenu({ onAdd, onClose }: {
    onAdd: (type: NodeType) => void; onClose: () => void;
}) {
    const types = Object.entries(NODE_TYPE_CONFIG) as [NodeType, typeof NODE_TYPE_CONFIG[NodeType]][];
    return (
        <div className="shortcut-overlay" onClick={onClose}>
            <div className="shortcut-palette" onClick={e => e.stopPropagation()}>
                <div className="shortcut-palette-title">Add to Canvas</div>
                {types.map(([type, config]) => (
                    <button key={type} className="shortcut-option" onClick={() => onAdd(type)}>
                        <span className="shortcut-icon">{config.icon}</span>
                        <span className="shortcut-label">{config.label}</span>
                    </button>
                ))}
                <div className="shortcut-hint">Esc to cancel</div>
            </div>
        </div>
    );
}

// ─── Machine Overview Panel (shows when no node selected) ───

function MachineOverviewPanel({ parentId, dbNodes, problems, statuses, victoryConditions, onUpdateProblem }: {
    parentId: string;
    dbNodes: MachineNode[];
    problems: Problem[];
    statuses: StatusConfig[];
    victoryConditions: VictoryCondition[];
    onUpdateProblem: (id: string, u: Partial<Problem>) => Promise<void>;
}) {
    const [parentNode, setParentNode] = useState<MachineNode | null>(null);

    useEffect(() => {
        db.nodes.get(parentId).then(n => setParentNode(n ?? null));
    }, [parentId]);

    // All child node IDs (for filtering)
    const childIds = new Set(dbNodes.map(n => n.id));
    childIds.add(parentId); // include the parent machine itself

    // Aggregate problems across all children + parent
    const allProblems = problems.filter(p => childIds.has(p.machineNodeId) && p.status !== 'resolved');
    const allProblemsTotal = problems.filter(p => childIds.has(p.machineNodeId));

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    for (const node of dbNodes) {
        const sid = node.statusId || 'not-built';
        statusCounts[sid] = (statusCounts[sid] ?? 0) + 1;
    }

    // Bottleneck nodes
    const bottleneckNodes = dbNodes.filter(n => n.bottleneck && n.bottleneck.trim());
    const blockedNodes = dbNodes.filter(n => n.statusId === 'blocked');

    // Unmet VCs across all children
    const childVCs = victoryConditions.filter(vc => childIds.has(vc.machineNodeId));
    const metVCs = childVCs.filter(vc => vc.met);

    // Resolved count
    const resolvedCount = allProblemsTotal.filter(p => p.status === 'resolved').length;

    const machineName = parentNode?.label || 'Machine';

    return (
        <div className="side-panel overview-panel">
            <div className="sp-header">
                <div className="sp-title-row">
                    <span className="sp-type-badge" style={{ background: '#4262FF20', color: '#4262FF' }}>📊</span>
                    <h2 className="sp-title">{machineName} Overview</h2>
                </div>
            </div>

            <div className="sp-content">
                {/* Status Breakdown */}
                <div className="sp-section">
                    <label className="sp-label">🏗️ Node Status ({dbNodes.length} nodes)</label>
                    <div className="overview-status-grid">
                        {statuses.map(s => {
                            const count = statusCounts[s.id] ?? 0;
                            if (count === 0) return null;
                            return (
                                <div key={s.id} className="overview-status-row">
                                    <span style={{ color: s.color }}>{s.icon} {s.label}</span>
                                    <span className="overview-count">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Blocked Nodes */}
                {blockedNodes.length > 0 && (
                    <Collapsible title={`Blocked (${blockedNodes.length})`} badge={blockedNodes.length} badgeColor="#ef4444" defaultOpen>
                        {blockedNodes.map(n => (
                            <div key={n.id} className="overview-blocked-node">
                                <span className="overview-node-name">{NODE_TYPE_CONFIG[n.type]?.icon} {n.label}</span>
                                {n.bottleneck && <span className="overview-bottleneck-text">→ {n.bottleneck}</span>}
                            </div>
                        ))}
                    </Collapsible>
                )}

                {/* Bottlenecks */}
                {bottleneckNodes.length > 0 && (
                    <Collapsible title={`Bottlenecks (${bottleneckNodes.length})`} badge={bottleneckNodes.length} badgeColor="#fbbf24" defaultOpen>
                        {bottleneckNodes.map(n => (
                            <div key={n.id} className="overview-bottleneck-card">
                                <span className="overview-node-name">{NODE_TYPE_CONFIG[n.type]?.icon} {n.label}</span>
                                <span className="overview-bottleneck-text">{n.bottleneck}</span>
                            </div>
                        ))}
                    </Collapsible>
                )}

                {/* Problems */}
                <Collapsible title={`All Problems (${allProblems.length} open${resolvedCount > 0 ? `, ${resolvedCount} resolved` : ''})`} badge={allProblems.length || undefined} badgeColor="#ef4444" defaultOpen={allProblems.length > 0}>
                    {allProblems.length === 0 && <p className="sp-text placeholder">No open problems across any node 🎉</p>}
                    {allProblems
                        .sort((a, b) => (PROBLEM_SEVERITY_ORDER[a.severity] ?? 9) - (PROBLEM_SEVERITY_ORDER[b.severity] ?? 9))
                        .map(p => {
                            const ownerNode = dbNodes.find(n => n.id === p.machineNodeId);
                            return (
                                <div key={p.id} className={`problem-card severity-${p.severity}`}>
                                    <div className="problem-card-top">
                                        <span className="problem-title">{p.title}</span>
                                        <select className="problem-status-select" value={p.status}
                                            onChange={e => onUpdateProblem(p.id, {
                                                status: e.target.value as Problem['status'],
                                                resolvedAt: e.target.value === 'resolved' ? new Date() : null,
                                            })}>
                                            {(['open', 'diagnosing', 'planned', 'fixing', 'resolved'] as const).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="problem-meta">
                                        <span className="problem-age">⏱ {formatDaysSince(p.createdAt)}</span>
                                        {ownerNode && <span className="overview-problem-source">on {ownerNode.label}</span>}
                                    </div>
                                </div>
                            );
                        })
                    }
                </Collapsible>

                {/* Victory Conditions */}
                {childVCs.length > 0 && (
                    <Collapsible title={`Victory Conditions (${metVCs.length}/${childVCs.length} met)`} badge={childVCs.length - metVCs.length || undefined} badgeColor="#f59e0b" defaultOpen>
                        {childVCs.map(vc => {
                            const ownerNode = dbNodes.find(n => n.id === vc.machineNodeId);
                            return (
                                <div key={vc.id} className={`overview-vc-row ${vc.met ? 'met' : 'unmet'}`}>
                                    <span className="overview-vc-status">{vc.met ? '✅' : '❌'}</span>
                                    <div className="overview-vc-info">
                                        <span className="overview-vc-label">{vc.label || '(unnamed)'}</span>
                                        {vc.target && <span className="overview-vc-target">{vc.current || '?'} / {vc.target}</span>}
                                        {ownerNode && <span className="overview-vc-source">on {ownerNode.label}</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </Collapsible>
                )}
            </div>
        </div>
    );
}

// ─── Side Panel ───

type PanelTab = 'design' | 'operations' | 'metrics' | 'notes';

function SidePanel({
    selectedNode, problems, statuses, victoryConditions, dbNodes,
    parentId,
    onClose, onUpdateNode, onAddProblem, onUpdateProblem,
    onAddVC, onUpdateVC, onDeleteVC,
}: {
    selectedNode: MachineNode | null;
    problems: Problem[]; statuses: StatusConfig[];
    victoryConditions: VictoryCondition[];
    dbNodes: MachineNode[];
    parentId: string;
    onClose: () => void;
    onUpdateNode: (id: string, updates: Partial<MachineNode>) => Promise<void>;
    onAddProblem: (id: string) => Promise<void>;
    onUpdateProblem: (id: string, updates: Partial<Problem>) => Promise<void>;
    onAddVC: (id: string) => Promise<void>;
    onUpdateVC: (id: string, updates: Partial<VictoryCondition>) => Promise<void>;
    onDeleteVC: (id: string) => Promise<void>;
}) {
    const [activeTab, setActiveTab] = useState<PanelTab>('design');
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    useEffect(() => { setEditingField(null); }, [selectedNode?.id]);
    // Auto-select best tab per type
    useEffect(() => {
        if (!selectedNode) return;
        if (selectedNode.type === 'note') setActiveTab('notes');
        else if (selectedNode.type === 'sop') setActiveTab('design');
        else setActiveTab('design');
    }, [selectedNode?.id, selectedNode?.type]);

    if (!selectedNode) {
        return (
            <MachineOverviewPanel
                parentId={parentId}
                dbNodes={dbNodes}
                problems={problems}
                statuses={statuses}
                victoryConditions={victoryConditions}
                onUpdateProblem={onUpdateProblem}
            />
        );
    }

    const nodeType = selectedNode.type || 'machine';
    const typeConfig = NODE_TYPE_CONFIG[nodeType];
    const nodeProblems = problems.filter(p => p.machineNodeId === selectedNode.id && p.status !== 'resolved');
    const nodeConditions = victoryConditions.filter(v => v.machineNodeId === selectedNode.id);
    const status = statuses.find(s => s.id === selectedNode.statusId);

    const startEdit = (field: string, val: string) => { setEditingField(field); setEditValue(val); };
    const saveEdit = async (field: string) => {
        const u: Partial<MachineNode> = {};
        if (field === 'label') u.label = editValue;
        else if (field === 'description') u.description = editValue;
        else if (field === 'goal') u.goal = editValue;
        else if (field === 'bottleneck') u.bottleneck = editValue;
        else if (field === 'notes') u.notes = editValue;
        else if (field === 'toolUrl') u.toolUrl = editValue;
        if (Object.keys(u).length) await onUpdateNode(selectedNode.id, u);
        setEditingField(null);
    };
    const handleKD = (e: React.KeyboardEvent, f: string) => {
        if (e.key === 'Enter' && !e.shiftKey) saveEdit(f);
        if (e.key === 'Escape') setEditingField(null);
    };

    // Determine available tabs based on type
    const tabs: { key: PanelTab; label: string; badge?: number }[] = [];
    if (nodeType === 'machine') {
        tabs.push({ key: 'design', label: 'Design' });
        tabs.push({ key: 'operations', label: 'Ops', badge: nodeProblems.length || undefined });
        tabs.push({ key: 'metrics', label: 'Metrics' });
        tabs.push({ key: 'notes', label: 'Notes' });
    } else if (nodeType === 'sop') {
        tabs.push({ key: 'design', label: 'Steps' });
        tabs.push({ key: 'notes', label: 'Notes' });
    } else if (nodeType === 'tool') {
        tabs.push({ key: 'design', label: 'Details' });
        tabs.push({ key: 'notes', label: 'Notes' });
    } else if (nodeType === 'skill') {
        tabs.push({ key: 'design', label: 'Details' });
        tabs.push({ key: 'notes', label: 'Notes' });
    } else if (nodeType === 'note') {
        tabs.push({ key: 'notes', label: 'Content' });
    }

    return (
        <div className="side-panel">
            {/* Header */}
            <div className="sp-header">
                <div className="sp-title-row">
                    <span className="sp-type-badge" style={{ background: `${typeConfig.color}20`, color: typeConfig.color }}>
                        {typeConfig.icon}
                    </span>
                    {editingField === 'label' ? (
                        <input className="sp-title-input" value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => handleKD(e, 'label')}
                            onBlur={() => saveEdit('label')} autoFocus />
                    ) : (
                        <h2 className="sp-title" onClick={() => startEdit('label', selectedNode.label)}>
                            {selectedNode.label}
                        </h2>
                    )}
                    {nodeType === 'machine' && (
                        <span className="sp-status-dot" style={{ background: status?.color }} title={status?.label} />
                    )}
                </div>
                <button className="sp-close" onClick={onClose}><X size={18} /></button>
            </div>

            {/* Tabs */}
            {tabs.length > 1 && (
                <div className="sp-tabs">
                    {tabs.map(t => (
                        <button key={t.key}
                            className={`sp-tab ${activeTab === t.key ? 'active' : ''}`}
                            onClick={() => setActiveTab(t.key)}>
                            {t.label}
                            {t.badge ? <span className="sp-tab-badge">{t.badge}</span> : null}
                        </button>
                    ))}
                </div>
            )}

            {/* Content */}
            <div className="sp-content">
                {/* ----- MACHINE ----- */}
                {nodeType === 'machine' && activeTab === 'design' && (
                    <MachineDesignPanel node={selectedNode} ef={editingField} ev={editValue}
                        startEdit={startEdit} setEV={setEditValue} saveEdit={saveEdit} />
                )}
                {nodeType === 'machine' && activeTab === 'operations' && (
                    <MachineOpsPanel node={selectedNode} statuses={statuses} problems={nodeProblems}
                        ef={editingField} ev={editValue} startEdit={startEdit} setEV={setEditValue}
                        handleKD={handleKD} saveEdit={saveEdit} onUpdateNode={onUpdateNode}
                        onAddProblem={onAddProblem} onUpdateProblem={onUpdateProblem} />
                )}
                {nodeType === 'machine' && activeTab === 'metrics' && (
                    <MetricsPanel node={selectedNode} conditions={nodeConditions}
                        onAdd={onAddVC} onUpdate={onUpdateVC} onDelete={onDeleteVC} />
                )}

                {/* ----- SOP ----- */}
                {nodeType === 'sop' && activeTab === 'design' && (
                    <SopPanel node={selectedNode} onUpdateNode={onUpdateNode} siblingNodes={dbNodes} />
                )}

                {/* ----- TOOL ----- */}
                {nodeType === 'tool' && activeTab === 'design' && (
                    <ToolPanel node={selectedNode} statuses={statuses}
                        ef={editingField} ev={editValue} startEdit={startEdit}
                        setEV={setEditValue} handleKD={handleKD} saveEdit={saveEdit}
                        onUpdateNode={onUpdateNode} />
                )}

                {/* ----- SKILL ----- */}
                {nodeType === 'skill' && activeTab === 'design' && (
                    <SkillPanel node={selectedNode} onUpdateNode={onUpdateNode} />
                )}

                {/* ----- NOTES (universal) ----- */}
                {activeTab === 'notes' && (
                    <NotesPanel node={selectedNode} ef={editingField} ev={editValue}
                        startEdit={startEdit} setEV={setEditValue} saveEdit={saveEdit} />
                )}
            </div>
        </div>
    );
}

// ─── Machine Design Panel ───

function MachineDesignPanel({ node, ef, ev, startEdit, setEV, saveEdit }: {
    node: MachineNode; ef: string | null; ev: string;
    startEdit: (f: string, v: string) => void; setEV: (v: string) => void;
    saveEdit: (f: string) => Promise<void>;
}) {
    return (
        <>
            <div className="sp-section">
                <label className="sp-label">Goal</label>
                {ef === 'goal' ? (
                    <textarea className="sp-textarea" value={ev} onChange={e => setEV(e.target.value)}
                        onBlur={() => saveEdit('goal')} onKeyDown={e => { if (e.key === 'Escape') saveEdit('goal'); }}
                        placeholder="What should this machine produce?" autoFocus />
                ) : (
                    <p className={`sp-text editable ${!node.goal ? 'placeholder' : ''}`}
                        onClick={() => startEdit('goal', node.goal)}>
                        {node.goal || 'What should this machine produce?'}
                    </p>
                )}
            </div>
            <div className="sp-section">
                <label className="sp-label">Description</label>
                {ef === 'description' ? (
                    <textarea className="sp-textarea" value={ev} onChange={e => setEV(e.target.value)}
                        onBlur={() => saveEdit('description')} onKeyDown={e => { if (e.key === 'Escape') saveEdit('description'); }}
                        placeholder="How does this machine work?" autoFocus />
                ) : (
                    <p className={`sp-text editable ${!node.description ? 'placeholder' : ''}`}
                        onClick={() => startEdit('description', node.description)}>
                        {node.description || 'How does this machine work?'}
                    </p>
                )}
            </div>
        </>
    );
}

// ─── Machine Ops Panel ───

function MachineOpsPanel({ node, statuses, problems, ef, ev, startEdit, setEV, handleKD,
    saveEdit, onUpdateNode, onAddProblem, onUpdateProblem }: {
        node: MachineNode; statuses: StatusConfig[]; problems: Problem[];
        ef: string | null; ev: string;
        startEdit: (f: string, v: string) => void; setEV: (v: string) => void;
        handleKD: (e: React.KeyboardEvent, f: string) => void; saveEdit: (f: string) => Promise<void>;
        onUpdateNode: (id: string, u: Partial<MachineNode>) => Promise<void>;
        onAddProblem: (id: string) => Promise<void>;
        onUpdateProblem: (id: string, u: Partial<Problem>) => Promise<void>;
    }) {
    const [severityFilter, setSeverityFilter] = useState<string>('');
    const [showStatusHistory, setShowStatusHistory] = useState(false);
    const [statusChanges, setStatusChanges] = useState<{ fromStatusId: string; toStatusId: string; changedAt: Date }[]>([]);

    useEffect(() => {
        db.statusChanges.where('machineNodeId').equals(node.id).toArray().then(changes => {
            setStatusChanges(changes.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()));
        });
    }, [node.id, node.statusId]);

    // Sort: severity order, then oldest first
    const sortedProblems = [...problems]
        .filter(p => !severityFilter || p.severity === severityFilter)
        .sort((a, b) => {
            const sevDiff = (PROBLEM_SEVERITY_ORDER[a.severity] ?? 9) - (PROBLEM_SEVERITY_ORDER[b.severity] ?? 9);
            if (sevDiff !== 0) return sevDiff;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
    return (
        <>
            <div className="sp-section">
                <label className="sp-label">Status <span className="sp-shortcut">⌘J</span></label>
                <div className="sp-status-grid">
                    {statuses.map((s, i) => (
                        <button key={s.id} className={`sp-status-btn ${s.id === node.statusId ? 'active' : ''}`}
                            style={{ '--sc': s.color } as React.CSSProperties}
                            onClick={() => onUpdateNode(node.id, { statusId: s.id })}>
                            <span>{s.icon}</span><span>{s.label}</span>
                            <span className="sp-status-key">{i + 1}</span>
                        </button>
                    ))}
                </div>
                {statusChanges.length > 0 && (
                    <button className="status-history-toggle" onClick={() => setShowStatusHistory(!showStatusHistory)}>
                        📜 {statusChanges.length} status change{statusChanges.length !== 1 ? 's' : ''}
                    </button>
                )}
                {showStatusHistory && statusChanges.length > 0 && (
                    <div className="status-history-list">
                        {statusChanges.slice(0, 10).map((ch, i) => {
                            const from = statuses.find(s => s.id === ch.fromStatusId);
                            const to = statuses.find(s => s.id === ch.toStatusId);
                            return (
                                <div key={i} className="status-history-item">
                                    <span className="status-history-date">{new Date(ch.changedAt).toLocaleDateString()}</span>
                                    <span style={{ color: from?.color }}>{from?.icon} {from?.label}</span>
                                    <span className="status-history-arrow">→</span>
                                    <span style={{ color: to?.color }}>{to?.icon} {to?.label}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <div className="sp-section">
                <label className="sp-label">🔻 Bottleneck</label>
                {ef === 'bottleneck' ? (
                    <input className="sp-input" value={ev} onChange={e => setEV(e.target.value)}
                        onKeyDown={e => handleKD(e, 'bottleneck')} onBlur={() => saveEdit('bottleneck')}
                        placeholder="What's blocking this machine?" autoFocus />
                ) : (
                    <p className={`sp-text editable ${!node.bottleneck ? 'placeholder' : ''}`}
                        onClick={() => startEdit('bottleneck', node.bottleneck || '')}>
                        {node.bottleneck || 'What\'s blocking this machine?'}
                    </p>
                )}
            </div>
            <Collapsible title={`Problems (${problems.length})`} badge={problems.length || undefined} badgeColor="#ef4444" defaultOpen={problems.length > 0}>
                <div className="sp-section-header" style={{ marginBottom: '8px' }}>
                    <button className="sp-add-btn" onClick={() => onAddProblem(node.id)}>
                        <Plus size={13} /> Log
                    </button>
                </div>
                {problems.length > 1 && (
                    <div className="problem-severity-filters">
                        <button className={`sev-filter-btn ${severityFilter === '' ? 'active' : ''}`}
                            onClick={() => setSeverityFilter('')}>All</button>
                        {(['critical', 'high', 'medium', 'low'] as const).map(s => (
                            <button key={s} className={`sev-filter-btn sev-${s} ${severityFilter === s ? 'active' : ''}`}
                                onClick={() => setSeverityFilter(severityFilter === s ? '' : s)}>{s}</button>
                        ))}
                    </div>
                )}
                {sortedProblems.length === 0 && <p className="sp-text placeholder">No open problems</p>}
                {sortedProblems.map(p => <ProblemCard key={p.id} problem={p} onUpdate={onUpdateProblem} />)}
            </Collapsible>
        </>
    );
}

// ─── Problem Card ───

function ProblemCard({ problem, onUpdate }: {
    problem: Problem; onUpdate: (id: string, u: Partial<Problem>) => Promise<void>;
}) {
    const [ef, setEF] = useState<string | null>(null);
    const [ev, setEV] = useState('');
    const startEdit = (f: string, v: string) => { setEF(f); setEV(v); };
    const save = async (f: string) => {
        if (f === 'title') await onUpdate(problem.id, { title: ev });
        else if (f === 'diagnosis') await onUpdate(problem.id, { diagnosis: ev, status: ev ? 'diagnosing' : 'open' });
        else if (f === 'plan') await onUpdate(problem.id, { plan: ev, status: ev ? 'planned' : 'diagnosing' });
        setEF(null);
    };
    const allStatuses: Problem['status'][] = ['open', 'diagnosing', 'planned', 'fixing', 'resolved'];
    const daysAgo = formatDaysSince(problem.createdAt);
    return (
        <div className={`problem-card severity-${problem.severity}`}>
            <div className="problem-card-top">
                {ef === 'title' ? (
                    <input className="problem-title-input" value={ev} onChange={e => setEV(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') save('title'); if (e.key === 'Escape') setEF(null); }}
                        onBlur={() => save('title')} autoFocus />
                ) : (
                    <span className="problem-title" onClick={() => startEdit('title', problem.title)}>{problem.title}</span>
                )}
                <select className="problem-status-select" value={problem.status}
                    onChange={e => onUpdate(problem.id, {
                        status: e.target.value as Problem['status'],
                        resolvedAt: e.target.value === 'resolved' ? new Date() : null,
                    })}>
                    {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div className="problem-meta">
                <span className="problem-age">⏱ Logged {daysAgo}</span>
                <select className="problem-severity-select" value={problem.severity}
                    onChange={e => onUpdate(problem.id, { severity: e.target.value as Problem['severity'] })}>
                    {(['critical', 'high', 'medium', 'low'] as const).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            {ef === 'diagnosis' ? (
                <input className="problem-field-input" value={ev} onChange={e => setEV(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') save('diagnosis'); if (e.key === 'Escape') setEF(null); }}
                    onBlur={() => save('diagnosis')} placeholder="Root cause?" autoFocus />
            ) : problem.diagnosis ? (
                <div className="problem-field" onClick={() => startEdit('diagnosis', problem.diagnosis)}>
                    <span className="problem-field-label">Root cause:</span> {problem.diagnosis}
                </div>
            ) : (
                <div className="problem-prompt" onClick={() => startEdit('diagnosis', '')}>⚠ Diagnose root cause</div>
            )}
            {problem.diagnosis && (
                ef === 'plan' ? (
                    <input className="problem-field-input" value={ev} onChange={e => setEV(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') save('plan'); if (e.key === 'Escape') setEF(null); }}
                        onBlur={() => save('plan')} placeholder="What's the fix?" autoFocus />
                ) : problem.plan ? (
                    <div className="problem-field" onClick={() => startEdit('plan', problem.plan)}>
                        <span className="problem-field-label">Plan:</span> {problem.plan}
                    </div>
                ) : (
                    <div className="problem-prompt" onClick={() => startEdit('plan', '')}>⚠ Design plan</div>
                )
            )}
        </div>
    );
}

// ─── Metrics Panel ───

function MetricsPanel({ node, conditions, onAdd, onUpdate, onDelete }: {
    node: MachineNode; conditions: VictoryCondition[];
    onAdd: (id: string) => Promise<void>;
    onUpdate: (id: string, u: Partial<VictoryCondition>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}) {
    const [snapshots, setSnapshots] = useState<VCSnapshot[]>([]);

    useEffect(() => {
        db.vcSnapshots.where('machineNodeId').equals(node.id).toArray().then(setSnapshots);
    }, [node.id]);

    const recordSnapshot = async () => {
        const newSnaps: VCSnapshot[] = conditions.map(vc => ({
            id: uuid(), victoryConditionId: vc.id, machineNodeId: node.id,
            value: vc.current, met: vc.met, recordedAt: new Date(),
        }));
        await db.vcSnapshots.bulkAdd(newSnaps);
        // Phase 4: log metric snapshot event
        await db.events.add({ id: uuid(), nodeId: node.id, eventType: 'metric-snapshot', timestamp: new Date(), metadata: `${conditions.length} conditions` });
        setSnapshots(prev => [...prev, ...newSnaps]);
    };

    return (
        <div className="sp-section">
            <div className="sp-section-header">
                <label className="sp-label">Victory Conditions</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {conditions.length > 0 && (
                        <button className="sp-add-btn" onClick={recordSnapshot} title="Save current values as a data point">📸 Snapshot</button>
                    )}
                    <button className="sp-add-btn" onClick={() => onAdd(node.id)}><Plus size={13} /> Add</button>
                </div>
            </div>
            {conditions.length === 0 && (
                <p className="sp-text placeholder">No victory conditions yet. Click "Add" to define success.</p>
            )}
            {conditions.map(vc => {
                const vcSnaps = snapshots
                    .filter(s => s.victoryConditionId === vc.id)
                    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
                return <VCRow key={vc.id} vc={vc} snapshots={vcSnaps} onUpdate={onUpdate} onDelete={onDelete} />;
            })}
        </div>
    );
}

function VCRow({ vc, snapshots, onUpdate, onDelete }: {
    vc: VictoryCondition;
    snapshots: VCSnapshot[];
    onUpdate: (id: string, u: Partial<VictoryCondition>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}) {
    const [ef, setEF] = useState<string | null>(null);
    const [ev, setEV] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const startEdit = (f: string, v: string) => { setEF(f); setEV(v); };
    const save = async (f: string) => {
        if (f === 'label') await onUpdate(vc.id, { label: ev });
        else if (f === 'target') await onUpdate(vc.id, { target: ev });
        else if (f === 'current') await onUpdate(vc.id, { current: ev });
        setEF(null);
    };
    return (
        <div className={`vc-row ${vc.met ? 'met' : 'unmet'}`}>
            <button className="vc-toggle" onClick={() => onUpdate(vc.id, { met: !vc.met })}>
                {vc.met ? <Check size={14} /> : <XCircle size={14} />}
            </button>
            <div className="vc-content">
                {ef === 'label' ? (
                    <input className="vc-input" value={ev} onChange={e => setEV(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') save('label'); if (e.key === 'Escape') setEF(null); }}
                        onBlur={() => save('label')} autoFocus placeholder="Condition name" />
                ) : (
                    <span className="vc-label" onClick={() => startEdit('label', vc.label)}>
                        {vc.label || 'Click to name...'}
                    </span>
                )}
                <div className="vc-values">
                    {ef === 'target' ? (
                        <input className="vc-input small" value={ev} onChange={e => setEV(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') save('target'); if (e.key === 'Escape') setEF(null); }}
                            onBlur={() => save('target')} autoFocus placeholder="Target" />
                    ) : (
                        <span className="vc-value target" onClick={() => startEdit('target', vc.target)}>
                            {vc.target || 'Set target'}
                        </span>
                    )}
                    <span className="vc-arrow">→</span>
                    {ef === 'current' ? (
                        <input className="vc-input small" value={ev} onChange={e => setEV(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') save('current'); if (e.key === 'Escape') setEF(null); }}
                            onBlur={() => save('current')} autoFocus placeholder="Current" />
                    ) : (
                        <span className="vc-value current" onClick={() => startEdit('current', vc.current)}>
                            {vc.current || 'Set current'}
                        </span>
                    )}
                </div>
                {/* Time-series history */}
                {snapshots.length > 0 && (
                    <div className="vc-history">
                        <button className="vc-history-toggle" onClick={() => setShowHistory(!showHistory)}>
                            📈 {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
                        </button>
                        {showHistory && (
                            <div className="vc-history-list">
                                {snapshots.map(s => (
                                    <div key={s.id} className={`vc-history-item ${s.met ? 'met' : 'unmet'}`}>
                                        <span className="vc-history-date">{new Date(s.recordedAt).toLocaleDateString()}</span>
                                        <span className="vc-history-value">{s.value || '—'}</span>
                                        <span>{s.met ? '✅' : '❌'}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <button className="vc-delete" onClick={() => onDelete(vc.id)}><Trash2 size={12} /></button>
        </div>
    );
}

// ─── SOP Panel ───

function SopPanel({ node, onUpdateNode, siblingNodes }: {
    node: MachineNode;
    onUpdateNode: (id: string, u: Partial<MachineNode>) => Promise<void>;
    siblingNodes?: MachineNode[];
}) {
    const steps = node.steps ?? [];
    const [newStep, setNewStep] = useState('');
    const [dragIdx, setDragIdx] = useState<number | null>(null);

    const addStep = async () => {
        if (!newStep.trim()) return;
        const updated = [...steps, { id: uuid(), text: newStep.trim(), done: false, order: steps.length }];
        await onUpdateNode(node.id, { steps: updated });
        setNewStep('');
    };
    const toggleStep = async (stepId: string) => {
        const step = steps.find(s => s.id === stepId);
        const updated = steps.map(s => s.id === stepId ? { ...s, done: !s.done } : s);
        await onUpdateNode(node.id, { steps: updated });
        // Phase 4: log step toggle event
        const eventType = step && !step.done ? 'step-completed' : 'step-uncompleted';
        await db.events.add({ id: uuid(), nodeId: node.id, eventType: eventType as any, timestamp: new Date(), metadata: stepId });
    };
    const deleteStep = async (stepId: string) => {
        const updated = steps.filter(s => s.id !== stepId);
        await onUpdateNode(node.id, { steps: updated });
    };
    const updateStepText = async (stepId: string, text: string) => {
        const updated = steps.map(s => s.id === stepId ? { ...s, text } : s);
        await onUpdateNode(node.id, { steps: updated });
    };
    const moveStep = async (fromIdx: number, toIdx: number) => {
        if (fromIdx === toIdx) return;
        const updated = [...steps];
        const [moved] = updated.splice(fromIdx, 1);
        updated.splice(toIdx, 0, moved);
        await onUpdateNode(node.id, { steps: updated.map((s, i) => ({ ...s, order: i })) });
    };
    const linkStep = async (stepId: string, linkedNodeId: string) => {
        const updated = steps.map(s => s.id === stepId ? { ...s, linkedNodeId: linkedNodeId || undefined } : s);
        await onUpdateNode(node.id, { steps: updated });
    };

    const doneCount = steps.filter(s => s.done).length;
    const linkableNodes = (siblingNodes ?? []).filter(n => n.type === 'tool' || n.type === 'skill');

    return (
        <div className="sp-section">
            <div className="sp-section-header">
                <label className="sp-label">📋 Steps ({doneCount}/{steps.length})</label>
            </div>
            {steps.length > 0 && (
                <div className="sop-progress-track">
                    <div className="sop-progress-fill" style={{ width: `${steps.length ? Math.round((doneCount / steps.length) * 100) : 0}%` }} />
                </div>
            )}
            <div className="sop-list">
                {steps.map((step, i) => (
                    <SopStepRow key={step.id} step={step} index={i}
                        onToggle={() => toggleStep(step.id)}
                        onDelete={() => deleteStep(step.id)}
                        onUpdate={(text) => updateStepText(step.id, text)}
                        onMoveUp={i > 0 ? () => moveStep(i, i - 1) : undefined}
                        onMoveDown={i < steps.length - 1 ? () => moveStep(i, i + 1) : undefined}
                        linkableNodes={linkableNodes}
                        onLink={(nodeId) => linkStep(step.id, nodeId)}
                        isDragging={dragIdx === i}
                        onDragStart={() => setDragIdx(i)}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={() => { if (dragIdx !== null) moveStep(dragIdx, i); setDragIdx(null); }}
                    />
                ))}
            </div>
            <div className="sop-add-row">
                <input className="sp-input" value={newStep} onChange={e => setNewStep(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addStep(); }}
                    placeholder="Add a step..." />
                <button className="sp-add-btn" onClick={addStep}><Plus size={13} /></button>
            </div>
        </div>
    );
}

function SopStepRow({ step, index, onToggle, onDelete, onUpdate, onMoveUp, onMoveDown, linkableNodes, onLink, isDragging, onDragStart, onDragOver, onDrop }: {
    step: SopStep; index: number;
    onToggle: () => void; onDelete: () => void; onUpdate: (text: string) => void;
    onMoveUp?: () => void; onMoveDown?: () => void;
    linkableNodes?: MachineNode[]; onLink?: (nodeId: string) => void;
    isDragging?: boolean;
    onDragStart?: () => void; onDragOver?: (e: React.DragEvent) => void; onDrop?: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(step.text);
    const [showLinkMenu, setShowLinkMenu] = useState(false);
    const linkedNode = linkableNodes?.find(n => n.id === step.linkedNodeId);
    return (
        <div className={`sop-step ${step.done ? 'done' : ''} ${isDragging ? 'dragging' : ''}`}
            draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
            <span className="sop-step-grip" title="Drag to reorder">
                <GripVertical size={12} />
            </span>
            <span className="sop-step-num">{index + 1}</span>
            <button className="sop-step-check" onClick={onToggle}>
                {step.done ? <Check size={14} /> : <div className="sop-check-empty" />}
            </button>
            <div className="sop-step-main">
                {editing ? (
                    <input className="sop-step-input" value={text} onChange={e => setText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { onUpdate(text); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
                        onBlur={() => { onUpdate(text); setEditing(false); }} autoFocus />
                ) : (
                    <span className="sop-step-text" onClick={() => setEditing(true)}>{step.text}</span>
                )}
                {linkedNode && (
                    <span className="sop-step-link" style={{ color: NODE_TYPE_CONFIG[linkedNode.type]?.color }}>
                        {NODE_TYPE_CONFIG[linkedNode.type]?.icon} {linkedNode.label}
                    </span>
                )}
            </div>
            <div className="sop-step-actions">
                {linkableNodes && linkableNodes.length > 0 && (
                    <div className="sop-link-wrapper">
                        <button className="sop-step-link-btn" onClick={() => setShowLinkMenu(!showLinkMenu)} title="Link to tool/skill">🔗</button>
                        {showLinkMenu && (
                            <div className="sop-link-menu">
                                <button className="sop-link-option" onClick={() => { onLink?.(''); setShowLinkMenu(false); }}>— None —</button>
                                {linkableNodes.map(n => (
                                    <button key={n.id} className={`sop-link-option ${step.linkedNodeId === n.id ? 'active' : ''}`}
                                        onClick={() => { onLink?.(n.id); setShowLinkMenu(false); }}>
                                        {NODE_TYPE_CONFIG[n.type]?.icon} {n.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {onMoveUp && <button className="sop-step-move" onClick={onMoveUp} title="Move up">↑</button>}
                {onMoveDown && <button className="sop-step-move" onClick={onMoveDown} title="Move down">↓</button>}
                <button className="sop-step-delete" onClick={onDelete}><Trash2 size={12} /></button>
            </div>
        </div>
    );
}

// ─── Tool Panel ───

function ToolPanel({ node, statuses, ef, ev, startEdit, setEV, handleKD, saveEdit, onUpdateNode }: {
    node: MachineNode; statuses: StatusConfig[];
    ef: string | null; ev: string;
    startEdit: (f: string, v: string) => void; setEV: (v: string) => void;
    handleKD: (e: React.KeyboardEvent, f: string) => void; saveEdit: (f: string) => Promise<void>;
    onUpdateNode: (id: string, u: Partial<MachineNode>) => Promise<void>;
}) {
    return (
        <>
            <div className="sp-section">
                <label className="sp-label"><ExternalLink size={13} /> URL / Link</label>
                {ef === 'toolUrl' ? (
                    <input className="sp-input" value={ev} onChange={e => setEV(e.target.value)}
                        onKeyDown={e => handleKD(e, 'toolUrl')} onBlur={() => saveEdit('toolUrl')}
                        placeholder="https://..." autoFocus />
                ) : (
                    <p className={`sp-text editable ${!node.toolUrl ? 'placeholder' : ''}`}
                        onClick={() => startEdit('toolUrl', node.toolUrl || '')}>
                        {node.toolUrl || 'Add link to tool...'}
                    </p>
                )}
                {node.toolUrl && (
                    <a href={node.toolUrl} target="_blank" rel="noreferrer" className="sp-link">
                        Open in browser <ExternalLink size={12} />
                    </a>
                )}
            </div>
            <div className="sp-section">
                <label className="sp-label">Status</label>
                <div className="sp-status-grid">
                    {statuses.map(s => (
                        <button key={s.id} className={`sp-status-btn ${s.id === node.statusId ? 'active' : ''}`}
                            style={{ '--sc': s.color } as React.CSSProperties}
                            onClick={() => onUpdateNode(node.id, { statusId: s.id })}>
                            <span>{s.icon}</span><span>{s.label}</span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="sp-section">
                <label className="sp-label">Description</label>
                {ef === 'description' ? (
                    <textarea className="sp-textarea" value={ev} onChange={e => setEV(e.target.value)}
                        onBlur={() => saveEdit('description')} placeholder="What is this tool for?" autoFocus />
                ) : (
                    <p className={`sp-text editable ${!node.description ? 'placeholder' : ''}`}
                        onClick={() => startEdit('description', node.description)}>
                        {node.description || 'What is this tool for?'}
                    </p>
                )}
            </div>
        </>
    );
}

// ─── Skill Panel ───

function SkillPanel({ node, onUpdateNode }: {
    node: MachineNode; onUpdateNode: (id: string, u: Partial<MachineNode>) => Promise<void>;
}) {
    return (
        <div className="sp-section">
            <label className="sp-label">⭐ Proficiency Level</label>
            <div className="skill-levels">
                {PROFICIENCY_LEVELS.map(level => (
                    <button key={level.value}
                        className={`skill-level-btn ${node.proficiency === level.value ? 'active' : ''}`}
                        onClick={() => onUpdateNode(node.id, { proficiency: level.value })}>
                        <span>{level.icon}</span>
                        <span>{level.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Notes Panel (universal) ───

function NotesPanel({ node, ef, ev, startEdit, setEV, saveEdit }: {
    node: MachineNode; ef: string | null; ev: string;
    startEdit: (f: string, v: string) => void; setEV: (v: string) => void;
    saveEdit: (f: string) => Promise<void>;
}) {
    return (
        <div className="sp-section notes-section">
            {ef === 'notes' ? (
                <textarea className="sp-textarea notes-textarea" value={ev}
                    onChange={e => setEV(e.target.value)}
                    onBlur={() => saveEdit('notes')}
                    placeholder="Write anything here — SOPs, links, ideas, context..."
                    autoFocus />
            ) : (
                <div className={`sp-text editable notes-display ${!node.notes ? 'placeholder' : ''}`}
                    onClick={() => startEdit('notes', node.notes || '')}>
                    {node.notes ? (
                        node.notes.split('\n').map((line, i) => <p key={i}>{line || '\u00A0'}</p>)
                    ) : (
                        'Click to add notes...'
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Whiteboard Inner ───

function WhiteboardInner() {
    const { machineId } = useParams<{ machineId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const parentId = searchParams.get('parent') ?? machineId ?? '';
    const navigate = useNavigate();
    const reactFlowInstance = useReactFlow();

    const [flowNodes, setFlowNodes] = useState<Node[]>([]);
    const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
    const [dbNodes, setDbNodes] = useState<MachineNode[]>([]);
    const [statuses, setStatuses] = useState<StatusConfig[]>([]);
    const [problems, setProblems] = useState<Problem[]>([]);
    const [victoryConditions, setVictoryConditions] = useState<VictoryCondition[]>([]);
    const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
    const [showShortcutOverlay, setShowShortcutOverlay] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [editingEdge, setEditingEdge] = useState<{ id: string; label: string; relationship: string } | null>(null);

    const setSearchParamsRef = useRef(setSearchParams);
    setSearchParamsRef.current = setSearchParams;

    const nodeCallbacks = useRef({
        onDrillDown: (nodeId: string) => { setSearchParamsRef.current({ parent: nodeId }); },
        onSelect: (_nodeId: string) => { },
    });

    useEffect(() => { db.statuses.orderBy('order').toArray().then(setStatuses); }, []);

    // Load data
    useEffect(() => {
        if (!parentId) return;

        // Track last viewed machine for CaptureBar
        localStorage.setItem('lastViewedMachineId', parentId);

        Promise.all([
            db.nodes.where('parentId').equals(parentId).toArray(),
            db.edges.where('parentId').equals(parentId).toArray(),
            db.problems.toArray(),
            db.victoryConditions.toArray(),
        ]).then(([nodes, edges, allProblems, allConditions]) => {
            setDbNodes(nodes); setProblems(allProblems); setVictoryConditions(allConditions);
            const pCounts: Record<string, number> = {};
            allProblems.filter(p => p.status !== 'resolved').forEach(p => {
                pCounts[p.machineNodeId] = (pCounts[p.machineNodeId] ?? 0) + 1;
            });
            setFlowNodes(nodes.map(n => toFlowNode(n, statuses, pCounts, nodeCallbacks.current)));
            setFlowEdges(edges.map(e => toFlowEdge(e)));
        });
    }, [parentId, statuses]);

    // Breadcrumbs
    useEffect(() => {
        async function build() {
            const trail: BreadcrumbSegment[] = [];
            let cid: string | null = parentId;
            const visited = new Set<string>();
            while (cid && !visited.has(cid)) {
                visited.add(cid);
                const node: MachineNode | undefined = await db.nodes.get(cid);
                if (node) { trail.unshift({ id: node.id, label: node.label }); cid = node.parentId || null; }
                else break;
            }
            if (trail.length > 0) trail.unshift({ id: null, label: 'Machines' });
            setBreadcrumbs(trail);
        }
        build();
    }, [parentId]);

    // Keyboard shortcuts
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'j') { e.preventDefault(); if (selectedNodeId) setShowShortcutOverlay(true); }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [selectedNodeId]);

    const onNodesChange = useCallback((c: NodeChange[]) => setFlowNodes(n => applyNodeChanges(c, n)), []);
    const onEdgesChange = useCallback((c: EdgeChange[]) => setFlowEdges(e => applyEdgeChanges(c, e)), []);
    const onNodeDragStop = useCallback(async (_: unknown, node: Node) => { await db.nodes.update(node.id, { position: node.position }); }, []);
    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => { setSelectedNodeId(node.id); }, []);
    const onPaneClick = useCallback(() => { setSelectedNodeId(null); setContextMenu(null); setEditingEdge(null); }, []);

    const onEdgeClick = useCallback(async (_: React.MouseEvent, edge: Edge) => {
        const dbEdge = await db.edges.get(edge.id);
        if (dbEdge) {
            setEditingEdge({ id: dbEdge.id, label: dbEdge.label || '', relationship: dbEdge.relationship || 'feeds' });
        }
    }, []);

    const saveEdgeEdit = useCallback(async () => {
        if (!editingEdge) return;
        await db.edges.update(editingEdge.id, { label: editingEdge.label, relationship: editingEdge.relationship as any });
        const edges = await db.edges.where('parentId').equals(parentId).toArray();
        setFlowEdges(edges.map(e => toFlowEdge(e)));
        setEditingEdge(null);
    }, [editingEdge, parentId]);
    const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id }); }, []);

    // Add node of specific type
    const handleAddNode = useCallback(async (type: NodeType) => {
        if (!parentId) return;
        setShowAddMenu(false);
        const center = reactFlowInstance.screenToFlowPosition({ x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 });
        const typeConfig = NODE_TYPE_CONFIG[type];
        const defaults = defaultNodeFields(type);
        const newNode: MachineNode = {
            id: uuid(),
            parentId,
            type: defaults.type!,
            label: `New ${typeConfig.label}`,
            description: defaults.description!,
            statusId: defaults.statusId!,
            position: { x: center.x + Math.random() * 100, y: center.y + Math.random() * 100 },
            goal: defaults.goal!,
            bottleneck: defaults.bottleneck!,
            notes: defaults.notes!,
            steps: defaults.steps!,
            toolUrl: defaults.toolUrl!,
            proficiency: defaults.proficiency!,
            hasChildren: defaults.hasChildren!,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await db.nodes.add(newNode);
        // Phase 4: log node creation event
        await db.events.add({ id: uuid(), nodeId: newNode.id, eventType: 'node-created', timestamp: new Date() });
        setDbNodes(prev => [...prev, newNode]);
        const pCounts: Record<string, number> = {};
        problems.filter(p => p.status !== 'resolved').forEach(p => { pCounts[p.machineNodeId] = (pCounts[p.machineNodeId] ?? 0) + 1; });
        setFlowNodes(prev => [...prev, toFlowNode(newNode, statuses, pCounts, nodeCallbacks.current)]);
        setSelectedNodeId(newNode.id);
    }, [parentId, reactFlowInstance, statuses, problems]);

    const onConnect = useCallback(async (connection: Connection) => {
        if (!connection.source || !connection.target || !parentId) return;
        const e: MachineEdge = { id: uuid(), parentId, source: connection.source, target: connection.target, relationship: 'feeds' };
        await db.edges.add(e);
        setFlowEdges(prev => [...prev, toFlowEdge(e)]);
    }, [parentId]);

    const handleUpdateNode = useCallback(async (id: string, updates: Partial<MachineNode>) => {
        // Track status changes
        if (updates.statusId) {
            const currentNode = dbNodes.find(n => n.id === id);
            if (currentNode && currentNode.statusId !== updates.statusId) {
                await db.statusChanges.add({
                    id: uuid(), machineNodeId: id,
                    fromStatusId: currentNode.statusId, toStatusId: updates.statusId,
                    changedAt: new Date(),
                });
                // Phase 4: log status change event
                await db.events.add({
                    id: uuid(), nodeId: id, eventType: 'status-change', timestamp: new Date(),
                    previousValue: currentNode.statusId, newValue: updates.statusId,
                });
            }
        }
        // Phase 4: log note updates
        if (updates.notes !== undefined) {
            await db.events.add({ id: uuid(), nodeId: id, eventType: 'note-updated', timestamp: new Date() });
        }
        await db.nodes.update(id, { ...updates, updatedAt: new Date() });
        setDbNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
        const pCounts: Record<string, number> = {};
        problems.filter(p => p.status !== 'resolved').forEach(p => { pCounts[p.machineNodeId] = (pCounts[p.machineNodeId] ?? 0) + 1; });
        setFlowNodes(prev => prev.map(n => {
            if (n.id !== id) return n;
            const dbNode = dbNodes.find(dn => dn.id === id);
            if (!dbNode) return n;
            return toFlowNode({ ...dbNode, ...updates }, statuses, pCounts, nodeCallbacks.current);
        }));
    }, [dbNodes, statuses, problems]);

    const handleShortcutStatus = useCallback(async (statusId: string) => {
        if (selectedNodeId) await handleUpdateNode(selectedNodeId, { statusId });
        setShowShortcutOverlay(false);
    }, [selectedNodeId, handleUpdateNode]);

    const handleAddProblem = useCallback(async (machineNodeId: string) => {
        const p: Problem = {
            id: uuid(), machineNodeId, title: 'New Problem', description: '', severity: 'medium',
            status: 'open', diagnosis: '', plan: '', createdAt: new Date(), resolvedAt: null,
        };
        await db.problems.add(p);
        // Phase 4: log problem event
        await db.events.add({ id: uuid(), nodeId: machineNodeId, eventType: 'problem-logged', timestamp: new Date(), newValue: p.id });
        setProblems(prev => [...prev, p]);
    }, []);
    const handleUpdateProblem = useCallback(async (id: string, u: Partial<Problem>) => {
        const existing = await db.problems.get(id);
        await db.problems.update(id, u);
        // Phase 4: log problem resolved or updated
        if (u.status === 'resolved' && existing) {
            await db.events.add({ id: uuid(), nodeId: existing.machineNodeId, eventType: 'problem-resolved', timestamp: new Date(), metadata: id });
        } else if (existing) {
            await db.events.add({ id: uuid(), nodeId: existing.machineNodeId, eventType: 'problem-updated', timestamp: new Date(), metadata: id });
        }
        setProblems(prev => prev.map(p => p.id === id ? { ...p, ...u } : p));
    }, []);

    const handleAddVC = useCallback(async (machineNodeId: string) => {
        const vc: VictoryCondition = {
            id: uuid(), machineNodeId, label: '', target: '', current: '', met: false,
            order: victoryConditions.filter(v => v.machineNodeId === machineNodeId).length,
        };
        await db.victoryConditions.add(vc); setVictoryConditions(prev => [...prev, vc]);
    }, [victoryConditions]);
    const handleUpdateVC = useCallback(async (id: string, u: Partial<VictoryCondition>) => {
        const existing = await db.victoryConditions.get(id);
        await db.victoryConditions.update(id, u);
        // Phase 4: log metric update event
        if (existing) {
            await db.events.add({ id: uuid(), nodeId: existing.machineNodeId, eventType: 'metric-updated', timestamp: new Date(), previousValue: existing.current, newValue: u.current ?? existing.current });
        }
        setVictoryConditions(prev => prev.map(v => v.id === id ? { ...v, ...u } : v));
    }, []);
    const handleDeleteVC = useCallback(async (id: string) => {
        await db.victoryConditions.delete(id); setVictoryConditions(prev => prev.filter(v => v.id !== id));
    }, []);

    const handleDeleteNode = useCallback(async (nodeId: string) => {
        // Delete children and related data
        const children = await db.nodes.where('parentId').equals(nodeId).toArray();
        for (const c of children) await db.nodes.delete(c.id);
        await db.edges.filter(e => e.source === nodeId || e.target === nodeId).delete();
        await db.problems.where('machineNodeId').equals(nodeId).delete();
        await db.victoryConditions.where('machineNodeId').equals(nodeId).delete();
        await db.nodes.delete(nodeId);
        // Phase 4: log node deleted
        await db.events.add({ id: uuid(), nodeId, eventType: 'node-deleted', timestamp: new Date() } as MachineEvent);
        setDbNodes(prev => prev.filter(n => n.id !== nodeId));
        setFlowNodes(prev => prev.filter(n => n.id !== nodeId));
        setFlowEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
        if (selectedNodeId === nodeId) setSelectedNodeId(null);
        setContextMenu(null);
    }, [selectedNodeId]);

    useEffect(() => { const h = () => setContextMenu(null); document.addEventListener('click', h); return () => document.removeEventListener('click', h); }, []);

    const handleBreadcrumbClick = useCallback((seg: BreadcrumbSegment) => {
        if (seg.id === null) navigate('/'); else setSearchParams({ parent: seg.id });
    }, [navigate, setSearchParams]);

    const selectedDbNode = dbNodes.find(n => n.id === selectedNodeId) ?? null;

    return (
        <div className="whiteboard-page">
            <div className="whiteboard-header">
                <div className="whiteboard-header-left">
                    <button className="wb-back" onClick={() => {
                        if (breadcrumbs.length > 2) { const p = breadcrumbs[breadcrumbs.length - 2]; if (p) handleBreadcrumbClick(p); }
                        else navigate('/');
                    }}><ArrowLeft size={18} /></button>
                    <div className="breadcrumb">
                        {breadcrumbs.map((seg, i) => (
                            <span key={`${seg.id ?? 'root'}-${i}`}>
                                {i > 0 && <span className="bc-sep">›</span>}
                                <span className={`bc-item ${i === breadcrumbs.length - 1 ? 'active' : ''}`}
                                    onClick={() => i < breadcrumbs.length - 1 && handleBreadcrumbClick(seg)}>
                                    {seg.label}
                                </span>
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="whiteboard-content">
                <div className="whiteboard-canvas">
                    {flowNodes.length === 0 && (
                        <div className="canvas-empty">
                            <h3>Empty canvas</h3>
                            <p>Add machines, SOPs, tools, skills or notes</p>
                            <button className="btn btn-primary" onClick={() => setShowAddMenu(true)}>
                                <Plus size={16} /> Add First Node
                            </button>
                        </div>
                    )}

                    <ReactFlow
                        nodes={flowNodes} edges={flowEdges}
                        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                        onConnect={onConnect} onNodeDragStop={onNodeDragStop}
                        onNodeClick={onNodeClick} onNodeContextMenu={onNodeContextMenu}
                        onEdgeClick={onEdgeClick}
                        onPaneClick={onPaneClick} nodeTypes={nodeTypes}
                        fitView snapToGrid snapGrid={[20, 20]} minZoom={0.1} maxZoom={2}
                        defaultEdgeOptions={{
                            type: 'smoothstep', animated: true,
                            style: { strokeWidth: 2.5, stroke: '#64748b' },
                            markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#64748b' },
                        }}
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#334155" />
                        <Controls showInteractive={false} position="bottom-left" />
                        <MiniMap
                            nodeColor={(node: Node) => {
                                const d = node.data as unknown as MachineNodeData;
                                return d?.statusColor ?? '#6b7280';
                            }}
                            maskColor="rgba(0,0,0,0.4)"
                            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                        />
                        <Panel position="top-left" style={{ marginTop: '60px' }}>
                            <div className="toolbar">
                                <button className="toolbar-btn" onClick={() => setShowAddMenu(true)} title="Add node">
                                    <Plus size={18} />
                                </button>
                            </div>
                        </Panel>
                    </ReactFlow>

                    {contextMenu && (
                        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
                            <button className="ctx-item" onClick={() => { setSelectedNodeId(contextMenu.nodeId); setContextMenu(null); }}>
                                <Pencil size={14} /> Edit
                            </button>
                            <div className="ctx-divider" />
                            <button className="ctx-item danger" onClick={() => handleDeleteNode(contextMenu.nodeId)}>
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    )}

                    {/* Edge editing overlay */}
                    {editingEdge && (
                        <div className="edge-edit-panel" onClick={e => e.stopPropagation()}>
                            <div className="edge-edit-header">
                                <label className="sp-label">Edge Relationship</label>
                                <button className="sp-close" onClick={() => setEditingEdge(null)}><X size={14} /></button>
                            </div>
                            <div className="edge-edit-types">
                                {EDGE_RELATIONSHIPS.map(r => (
                                    <button key={r.value}
                                        className={`edge-type-btn ${editingEdge.relationship === r.value ? 'active' : ''}`}
                                        style={{ '--ec': r.color } as React.CSSProperties}
                                        onClick={() => setEditingEdge({ ...editingEdge, relationship: r.value })}>
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                            <input className="sp-input" value={editingEdge.label}
                                onChange={e => setEditingEdge({ ...editingEdge, label: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') saveEdgeEdit(); }}
                                placeholder="Custom label (optional)" />
                            <button className="btn btn-primary btn-sm" style={{ marginTop: '8px', width: '100%' }}
                                onClick={saveEdgeEdit}>Save</button>
                        </div>
                    )}
                </div>

                <SidePanel
                    selectedNode={selectedDbNode} problems={problems}
                    statuses={statuses} victoryConditions={victoryConditions}
                    dbNodes={dbNodes} parentId={parentId}
                    onClose={() => setSelectedNodeId(null)}
                    onUpdateNode={handleUpdateNode} onAddProblem={handleAddProblem}
                    onUpdateProblem={handleUpdateProblem}
                    onAddVC={handleAddVC} onUpdateVC={handleUpdateVC} onDeleteVC={handleDeleteVC}
                />
            </div>

            {showShortcutOverlay && (
                <ShortcutOverlay statuses={statuses} onSelect={handleShortcutStatus} onClose={() => setShowShortcutOverlay(false)} />
            )}
            {showAddMenu && (
                <AddNodeMenu onAdd={handleAddNode} onClose={() => setShowAddMenu(false)} />
            )}
        </div>
    );
}

export default function Whiteboard() {
    return <ReactFlowProvider><WhiteboardInner /></ReactFlowProvider>;
}
