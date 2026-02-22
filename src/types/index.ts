// ─── Node Types ───

export type NodeType = 'machine' | 'sop' | 'tool' | 'skill' | 'note';

export const NODE_TYPE_CONFIG: Record<NodeType, { label: string; icon: string; color: string }> = {
  machine: { label: 'Machine', icon: '⚙', color: '#6366f1' },
  sop: { label: 'SOP', icon: '📋', color: '#f59e0b' },
  tool: { label: 'Tool', icon: '🔧', color: '#3b82f6' },
  skill: { label: 'Skill', icon: '⭐', color: '#8b5cf6' },
  note: { label: 'Note', icon: '📝', color: '#64748b' },
};

// ─── Status Configuration ───

export interface StatusConfig {
  id: string;
  label: string;
  color: string;
  icon: string;
  order: number;
}

// ─── Machine Node ───

export interface MachineNode {
  id: string;
  parentId: string;
  type: NodeType;
  label: string;
  description: string;
  statusId: string;
  position: { x: number; y: number };
  goal: string;
  bottleneck: string;
  notes: string;
  steps: SopStep[];
  toolUrl: string;
  proficiency: ProficiencyLevel | null;
  hasChildren: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── SOP Step ───

export interface SopStep {
  id: string;
  text: string;
  done: boolean;
  order: number;
  linkedNodeId?: string;   // optional link to a tool/skill node
}

// ─── Proficiency Level ───

export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export const PROFICIENCY_LEVELS: { value: ProficiencyLevel; label: string; icon: string }[] = [
  { value: 'beginner', label: 'Beginner', icon: '🌱' },
  { value: 'intermediate', label: 'Intermediate', icon: '🌿' },
  { value: 'advanced', label: 'Advanced', icon: '🌳' },
  { value: 'expert', label: 'Expert', icon: '🏆' },
];

// ─── Edge Relationship Types ───

export type EdgeRelationship = 'feeds' | 'depends' | 'triggers' | 'supports' | 'custom';

export const EDGE_RELATIONSHIPS: { value: EdgeRelationship; label: string; color: string }[] = [
  { value: 'feeds', label: 'Feeds into', color: '#22c55e' },
  { value: 'depends', label: 'Depends on', color: '#f59e0b' },
  { value: 'triggers', label: 'Triggers', color: '#3b82f6' },
  { value: 'supports', label: 'Supports', color: '#8b5cf6' },
  { value: 'custom', label: 'Custom', color: '#64748b' },
];

// ─── Edge ───

export interface MachineEdge {
  id: string;
  parentId: string;
  source: string;
  target: string;
  label?: string;
  relationship: EdgeRelationship;
}

// ─── Victory Condition ───

export interface VictoryCondition {
  id: string;
  machineNodeId: string;
  label: string;
  target: string;
  current: string;
  met: boolean;
  order: number;
}

// ─── Victory Condition Snapshot (time series) ───

export interface VCSnapshot {
  id: string;
  victoryConditionId: string;
  machineNodeId: string;
  value: string;
  met: boolean;
  recordedAt: Date;
}

// ─── Status Change History ───

export interface StatusChange {
  id: string;
  machineNodeId: string;
  fromStatusId: string;
  toStatusId: string;
  changedAt: Date;
}

// ─── Problem ───

export type ProblemSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ProblemStatus = 'open' | 'diagnosing' | 'planned' | 'fixing' | 'resolved';

export const PROBLEM_SEVERITY_ORDER: Record<ProblemSeverity, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};

export interface Problem {
  id: string;
  machineNodeId: string;
  title: string;
  description: string;
  severity: ProblemSeverity;
  status: ProblemStatus;
  diagnosis: string;
  plan: string;
  createdAt: Date;
  resolvedAt: Date | null;
}

// ─── Lever ───

export interface Lever {
  id: string;
  machineNodeId: string;
  label: string;
  currentValue: string;
  description: string;
}

// ─── Principle ───

export interface Principle {
  id: string;
  machineNodeId: string;
  text: string;
  createdAt: Date;
}

// ─── Breadcrumb ───

export interface BreadcrumbSegment {
  id: string | null;
  label: string;
}

// ─── Capture (Phase 1) ───

export interface Capture {
  id: string;
  text: string;
  machineId: string;
  processed: boolean;
  createdAt: Date;
}

// ─── Machine Event (Phase 4 — universal event log) ───

export type EventType =
  | 'status-change'
  | 'problem-logged'
  | 'problem-resolved'
  | 'problem-updated'
  | 'metric-updated'
  | 'metric-snapshot'
  | 'step-completed'
  | 'step-uncompleted'
  | 'note-updated'
  | 'node-created'
  | 'node-deleted'
  | 'capture-processed';

export interface MachineEvent {
  id: string;
  nodeId: string;
  eventType: EventType;
  timestamp: Date;
  previousValue?: string;
  newValue?: string;
  metadata?: string;
}

// ─── Attention Thresholds (Phase 5) ───

export const ATTENTION_THRESHOLDS = {
  problem: { amber: 3, red: 7, critical: 14 },
  staleness: { amber: 7, red: 14, critical: 21 },
  capture: { amber: 1, red: 2, critical: 3 },
  blocked: { amber: 3, red: 7, critical: 14 },
};

// ─── Default Statuses (including "Paused") ───

export const DEFAULT_STATUSES: StatusConfig[] = [
  { id: 'running', label: 'Running', color: '#22c55e', icon: '🟢', order: 0 },
  { id: 'under', label: 'Under Construction', color: '#f59e0b', icon: '🟡', order: 1 },
  { id: 'blocked', label: 'Blocked', color: '#ef4444', icon: '🔴', order: 2 },
  { id: 'not-built', label: 'Not Built', color: '#6b7280', icon: '⚪', order: 3 },
  { id: 'optimizing', label: 'Optimizing', color: '#8b5cf6', icon: '🟣', order: 4 },
  { id: 'paused', label: 'Paused', color: '#94a3b8', icon: '⏸️', order: 5 },
];

// ─── Helpers ───

export function daysSince(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDaysSince(date: Date): string {
  const d = daysSince(date);
  if (d === 0) return 'today';
  if (d === 1) return '1 day ago';
  return `${d} days ago`;
}

export function formatDuration(ms: number): string {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return 'just now';
}

// Phase 4: Get time since last event of a given type for a node
export async function timeSinceEvent(nodeId: string, eventType: EventType): Promise<number | null> {
  const { db } = await import('../db');
  const events = await db.events
    .where('nodeId').equals(nodeId)
    .filter(e => e.eventType === eventType)
    .toArray();
  if (events.length === 0) return null;
  const latest = events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  return Date.now() - new Date(latest.timestamp).getTime();
}
