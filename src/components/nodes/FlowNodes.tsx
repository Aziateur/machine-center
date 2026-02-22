import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertTriangle, ArrowRight, CheckSquare, ExternalLink } from 'lucide-react';
import type { NodeType, ProficiencyLevel } from '../../types';
import { NODE_TYPE_CONFIG, PROFICIENCY_LEVELS } from '../../types';

export interface MachineNodeData {
    label: string;
    nodeType: NodeType;
    statusLabel: string;
    statusColor: string;
    statusIcon: string;
    goal: string;
    bottleneck: string;
    notes: string;
    hasChildren: boolean;
    problemCount: number;
    missingGoal: boolean;
    // SOP
    stepsTotal: number;
    stepsDone: number;
    // Tool
    toolUrl: string;
    // Skill
    proficiency: ProficiencyLevel | null;
    // Callbacks
    onDrillDown: (nodeId: string) => void;
    onSelect: (nodeId: string) => void;
}

function MachineNodeComponent({ id, data, selected }: NodeProps & { data: MachineNodeData }) {
    const typeConfig = NODE_TYPE_CONFIG[data.nodeType] || NODE_TYPE_CONFIG.machine;

    return (
        <div
            className={`machine-node type-${data.nodeType} ${selected ? 'selected' : ''}`}
            style={{ '--node-accent': data.statusColor, '--type-color': typeConfig.color } as React.CSSProperties}
            onClick={() => data.onSelect(id)}
        >
            {/* Connection handles — 4 sides */}
            <Handle type="target" position={Position.Top} id="top-target" />
            <Handle type="source" position={Position.Top} id="top-source" />
            <Handle type="target" position={Position.Right} id="right-target" />
            <Handle type="source" position={Position.Right} id="right-source" />
            <Handle type="target" position={Position.Bottom} id="bottom-target" />
            <Handle type="source" position={Position.Bottom} id="bottom-source" />
            <Handle type="target" position={Position.Left} id="left-target" />
            <Handle type="source" position={Position.Left} id="left-source" />

            {/* Type badge + status */}
            <div className="machine-node-header">
                <div className="machine-node-type-badge" style={{ background: `${typeConfig.color}20`, color: typeConfig.color }}>
                    {typeConfig.icon} {typeConfig.label}
                </div>
                <div className="machine-node-header-right">
                    {data.problemCount > 0 && (
                        <span className="machine-node-problems">
                            <AlertTriangle size={11} /> {data.problemCount}
                        </span>
                    )}
                    {data.nodeType === 'machine' && (
                        <span className="machine-node-status" style={{ color: data.statusColor }}>
                            {data.statusIcon}
                        </span>
                    )}
                </div>
            </div>

            {/* Name */}
            <div className="machine-node-label">{data.label}</div>

            {/* Type-specific content */}
            {data.nodeType === 'machine' && (
                <>
                    {data.goal ? (
                        <div className="machine-node-goal">{data.goal}</div>
                    ) : (
                        <div className="machine-node-prompt">
                            <AlertTriangle size={11} /> No goal set
                        </div>
                    )}
                    {data.bottleneck && (
                        <div className="machine-node-bottleneck">🔻 {data.bottleneck}</div>
                    )}
                </>
            )}

            {data.nodeType === 'sop' && (
                <div className="machine-node-sop-progress">
                    <CheckSquare size={13} />
                    <span>{data.stepsDone}/{data.stepsTotal} steps</span>
                    {data.stepsTotal > 0 && (
                        <div className="sop-progress-bar">
                            <div
                                className="sop-progress-fill"
                                style={{ width: `${Math.round((data.stepsDone / data.stepsTotal) * 100)}%` }}
                            />
                        </div>
                    )}
                </div>
            )}

            {data.nodeType === 'tool' && (
                <>
                    {data.toolUrl && (() => {
                        try {
                            return (
                                <div className="machine-node-tool-link">
                                    <ExternalLink size={11} />
                                    <span>{new URL(data.toolUrl).hostname}</span>
                                </div>
                            );
                        } catch { return null; }
                    })()}
                    <div className="machine-node-tool-status" style={{ color: data.statusColor }}>
                        {data.statusIcon} {data.statusLabel}
                    </div>
                </>
            )}

            {data.nodeType === 'skill' && (
                <div className="machine-node-skill-level">
                    {data.proficiency
                        ? PROFICIENCY_LEVELS.find(p => p.value === data.proficiency)?.icon + ' ' +
                        PROFICIENCY_LEVELS.find(p => p.value === data.proficiency)?.label
                        : '⬜ Not assessed'}
                </div>
            )}

            {data.nodeType === 'note' && data.notes && (
                <div className="machine-node-note-preview">
                    {data.notes.slice(0, 80)}{data.notes.length > 80 ? '...' : ''}
                </div>
            )}

            {/* Enter button — only for machines */}
            {(data.nodeType === 'machine') && (
                <button
                    className="machine-node-enter"
                    onClick={(e) => { e.stopPropagation(); data.onDrillDown(id); }}
                >
                    Enter <ArrowRight size={13} />
                </button>
            )}
        </div>
    );
}

export const nodeTypes = {
    machine: MachineNodeComponent,
};
