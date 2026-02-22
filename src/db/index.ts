import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Helpers: camelCase ↔ snake_case ───

function toSnake(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        result[snakeKey] = value;
    }
    return result;
}

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        result[camelKey] = value;
    }
    return result;
}



// ─── Generic table wrapper (matches Dexie's EntityTable API) ───

class SupabaseTable<T extends { id: string }> {
    tableName: string;
    fieldMap?: Record<string, string>;

    constructor(tableName: string, fieldMap?: Record<string, string>) {
        this.tableName = tableName;
        this.fieldMap = fieldMap;
    }

    toDbRow(obj: Partial<T>): Record<string, unknown> {
        const row = toSnake(obj as Record<string, unknown>);
        // Apply field map overrides
        if (this.fieldMap) {
            const camelObj = obj as Record<string, unknown>;
            for (const [camelKey, snakeKey] of Object.entries(this.fieldMap)) {
                if (camelKey in camelObj) {
                    row[snakeKey] = camelObj[camelKey];
                    // Remove the auto-generated snake key if different
                    const autoSnake = camelKey.replace(/([A-Z])/g, '_$1').toLowerCase();
                    if (autoSnake !== snakeKey) delete row[autoSnake];
                }
            }
        }
        return row;
    }

    fromDbRow(row: Record<string, unknown>): T {
        const result = toCamel(row);
        // Apply reverse field map
        if (this.fieldMap) {
            for (const [camelKey, snakeKey] of Object.entries(this.fieldMap)) {
                if (snakeKey in row) {
                    result[camelKey] = row[snakeKey];
                }
            }
        }
        return result as T;
    }

    fromDbRows(rows: Record<string, unknown>[]): T[] {
        return rows.map(r => this.fromDbRow(r));
    }

    async toArray(): Promise<T[]> {
        const { data, error } = await supabase.from(this.tableName).select('*');
        if (error) throw error;
        return this.fromDbRows(data || []);
    }

    // Client-side filter (matches Dexie's .filter())
    filter(fn: (item: T) => boolean) {
        const table = this;
        return {
            toArray: async (): Promise<T[]> => {
                const all = await table.toArray();
                return all.filter(fn);
            },
            sortBy: async (field: string): Promise<T[]> => {
                const all = await table.toArray();
                return all.filter(fn).sort((a, b) => {
                    const av = (a as Record<string, unknown>)[field];
                    const bv = (b as Record<string, unknown>)[field];
                    if (av instanceof Date && bv instanceof Date) return av.getTime() - bv.getTime();
                    if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv);
                    return 0;
                });
            },
            count: async (): Promise<number> => {
                const all = await table.toArray();
                return all.filter(fn).length;
            },
            delete: async (): Promise<void> => {
                const all = await table.toArray();
                const toDelete = all.filter(fn);
                for (const item of toDelete) {
                    await table.delete(item.id);
                }
            },
        };
    }

    async get(id: string): Promise<T | undefined> {
        const { data, error } = await supabase.from(this.tableName).select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return data ? this.fromDbRow(data) : undefined;
    }

    async add(item: T): Promise<string> {
        const row = this.toDbRow(item);
        const { error } = await supabase.from(this.tableName).insert(row);
        if (error) throw error;
        return item.id;
    }

    async bulkAdd(items: T[]): Promise<void> {
        if (items.length === 0) return;
        const rows = items.map(i => this.toDbRow(i));
        const { error } = await supabase.from(this.tableName).insert(rows);
        if (error) throw error;
    }

    async put(item: T): Promise<string> {
        const row = this.toDbRow(item);
        const { error } = await supabase.from(this.tableName).upsert(row);
        if (error) throw error;
        return item.id;
    }

    async update(id: string, updates: Partial<T>): Promise<void> {
        const row = this.toDbRow(updates);
        const { error } = await supabase.from(this.tableName).update(row).eq('id', id);
        if (error) throw error;
    }

    async delete(id: string): Promise<void> {
        const { error } = await supabase.from(this.tableName).delete().eq('id', id);
        if (error) throw error;
    }

    async clear(): Promise<void> {
        const { error } = await supabase.from(this.tableName).delete().neq('id', '');
        if (error) throw error;
    }

    async count(): Promise<number> {
        const { count, error } = await supabase.from(this.tableName).select('*', { count: 'exact', head: true });
        if (error) throw error;
        return count || 0;
    }

    // Chainable query builder (mimics Dexie's .where().equals() etc.)
    where(field: string) {
        const table = this;
        const snakeField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        // Check field map
        const mappedField = this.fieldMap?.[field] || snakeField;

        return {
            equals: (value: unknown) => ({
                toArray: async (): Promise<T[]> => {
                    const { data, error } = await supabase.from(table.tableName).select('*').eq(mappedField, value);
                    if (error) throw error;
                    return table.fromDbRows(data || []);
                },
                filter: (fn: (item: T) => boolean) => ({
                    toArray: async (): Promise<T[]> => {
                        const { data, error } = await supabase.from(table.tableName).select('*').eq(mappedField, value);
                        if (error) throw error;
                        return table.fromDbRows(data || []).filter(fn);
                    },
                }),
                modify: async (fn: (item: T) => void): Promise<void> => {
                    const { data, error } = await supabase.from(table.tableName).select('*').eq(mappedField, value);
                    if (error) throw error;
                    for (const row of (data || [])) {
                        const item = table.fromDbRow(row);
                        fn(item);
                        await table.update(item.id, item);
                    }
                },
                delete: async (): Promise<void> => {
                    const { error } = await supabase.from(table.tableName).delete().eq(mappedField, value);
                    if (error) throw error;
                },
                count: async (): Promise<number> => {
                    const { count, error } = await supabase.from(table.tableName).select('*', { count: 'exact', head: true }).eq(mappedField, value);
                    if (error) throw error;
                    return count || 0;
                },
            }),
        };
    }

    // Chainable .orderBy() mimicking Dexie
    orderBy(field: string) {
        const table = this;
        const snakeField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        const mappedField = this.fieldMap?.[field] || snakeField;

        return {
            toArray: async (): Promise<T[]> => {
                const { data, error } = await supabase.from(table.tableName).select('*').order(mappedField);
                if (error) throw error;
                return table.fromDbRows(data || []);
            },
        };
    }

    // For toCollection().modify()
    toCollection() {
        const table = this;
        return {
            modify: async (fn: (item: T) => void): Promise<void> => {
                const items = await table.toArray();
                for (const item of items) {
                    const original = JSON.stringify(item);
                    fn(item);
                    if (JSON.stringify(item) !== original) {
                        await table.update(item.id, item);
                    }
                }
            },
        };
    }
}

// ─── Database (mirrors Dexie db shape) ───

import type {
    MachineNode, MachineEdge, StatusConfig, Problem,
    Lever, Principle, VictoryCondition, VCSnapshot,
    StatusChange, Capture, MachineEvent,
} from '../types';

// Field mappings: camelCase property → snake_case column
const NODE_FIELDS = {
    parentId: 'parent_id',
    statusId: 'status_id',
    toolUrl: 'tool_url',
    hasChildren: 'has_children',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
};

const EDGE_FIELDS = {
    parentId: 'parent_id',
};

const PROBLEM_FIELDS = {
    machineNodeId: 'machine_node_id',
    createdAt: 'created_at',
    resolvedAt: 'resolved_at',
};

const VC_FIELDS = {
    machineNodeId: 'machine_node_id',
};

const VCS_FIELDS = {
    victoryConditionId: 'victory_condition_id',
    machineNodeId: 'machine_node_id',
    recordedAt: 'recorded_at',
};

const SC_FIELDS = {
    machineNodeId: 'machine_node_id',
    fromStatusId: 'from_status_id',
    toStatusId: 'to_status_id',
    changedAt: 'changed_at',
};

const LEVER_FIELDS = {
    machineNodeId: 'machine_node_id',
    currentValue: 'current_value',
};

const PRINCIPLE_FIELDS = {
    machineNodeId: 'machine_node_id',
    createdAt: 'created_at',
};

const CAPTURE_FIELDS = {
    machineId: 'machine_id',
    createdAt: 'created_at',
};

const EVENT_FIELDS = {
    nodeId: 'node_id',
    eventType: 'event_type',
    previousValue: 'previous_value',
    newValue: 'new_value',
};

export const db = {
    nodes: new SupabaseTable<MachineNode>('nodes', NODE_FIELDS),
    edges: new SupabaseTable<MachineEdge>('edges', EDGE_FIELDS),
    statuses: new SupabaseTable<StatusConfig>('statuses'),
    problems: new SupabaseTable<Problem>('problems', PROBLEM_FIELDS),
    levers: new SupabaseTable<Lever>('levers', LEVER_FIELDS),
    principles: new SupabaseTable<Principle>('principles', PRINCIPLE_FIELDS),
    victoryConditions: new SupabaseTable<VictoryCondition>('victory_conditions', VC_FIELDS),
    vcSnapshots: new SupabaseTable<VCSnapshot>('vc_snapshots', VCS_FIELDS),
    statusChanges: new SupabaseTable<StatusChange>('status_changes', SC_FIELDS),
    captures: new SupabaseTable<Capture>('captures', CAPTURE_FIELDS),
    events: new SupabaseTable<MachineEvent>('events', EVENT_FIELDS),
};
