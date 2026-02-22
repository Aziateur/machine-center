-- ═══════════════════════════════════════════════════
-- Machine Center — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════

-- ─── Statuses ───
CREATE TABLE IF NOT EXISTS statuses (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6b7280',
    icon TEXT NOT NULL DEFAULT '⚪',
    "order" INTEGER NOT NULL DEFAULT 0
);

-- Seed default statuses
INSERT INTO statuses (id, label, color, icon, "order") VALUES
    ('running', 'Running', '#22c55e', '🟢', 0),
    ('under', 'Under Construction', '#f59e0b', '🟡', 1),
    ('blocked', 'Blocked', '#ef4444', '🔴', 2),
    ('not-built', 'Not Built', '#6b7280', '⚪', 3),
    ('optimizing', 'Optimizing', '#8b5cf6', '🟣', 4),
    ('paused', 'Paused', '#94a3b8', '⏸️', 5)
ON CONFLICT (id) DO NOTHING;

-- ─── Nodes ───
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    parent_id TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'machine',
    label TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    status_id TEXT NOT NULL DEFAULT 'not-built' REFERENCES statuses(id),
    position JSONB NOT NULL DEFAULT '{"x": 0, "y": 0}',
    goal TEXT NOT NULL DEFAULT '',
    bottleneck TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    steps JSONB NOT NULL DEFAULT '[]',
    tool_url TEXT NOT NULL DEFAULT '',
    proficiency TEXT,
    has_children BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status_id);

-- ─── Edges ───
CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    parent_id TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    relationship TEXT NOT NULL DEFAULT 'feeds'
);

CREATE INDEX IF NOT EXISTS idx_edges_parent ON edges(parent_id);

-- ─── Problems ───
CREATE TABLE IF NOT EXISTS problems (
    id TEXT PRIMARY KEY,
    machine_node_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    diagnosis TEXT NOT NULL DEFAULT '',
    plan TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_problems_node ON problems(machine_node_id);
CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status);

-- ─── Victory Conditions ───
CREATE TABLE IF NOT EXISTS victory_conditions (
    id TEXT PRIMARY KEY,
    machine_node_id TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    target TEXT NOT NULL DEFAULT '',
    current TEXT NOT NULL DEFAULT '',
    met BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_vc_node ON victory_conditions(machine_node_id);

-- ─── VC Snapshots ───
CREATE TABLE IF NOT EXISTS vc_snapshots (
    id TEXT PRIMARY KEY,
    victory_condition_id TEXT NOT NULL,
    machine_node_id TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    met BOOLEAN NOT NULL DEFAULT false,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vcs_vc ON vc_snapshots(victory_condition_id);
CREATE INDEX IF NOT EXISTS idx_vcs_node ON vc_snapshots(machine_node_id);

-- ─── Status Changes ───
CREATE TABLE IF NOT EXISTS status_changes (
    id TEXT PRIMARY KEY,
    machine_node_id TEXT NOT NULL,
    from_status_id TEXT NOT NULL DEFAULT '',
    to_status_id TEXT NOT NULL DEFAULT '',
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sc_node ON status_changes(machine_node_id);

-- ─── Levers ───
CREATE TABLE IF NOT EXISTS levers (
    id TEXT PRIMARY KEY,
    machine_node_id TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    current_value TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_levers_node ON levers(machine_node_id);

-- ─── Principles ───
CREATE TABLE IF NOT EXISTS principles (
    id TEXT PRIMARY KEY,
    machine_node_id TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_principles_node ON principles(machine_node_id);

-- ─── Captures ───
CREATE TABLE IF NOT EXISTS captures (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL DEFAULT '',
    machine_id TEXT NOT NULL DEFAULT '',
    processed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_captures_machine ON captures(machine_id);
CREATE INDEX IF NOT EXISTS idx_captures_processed ON captures(processed);

-- ─── Events ───
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    previous_value TEXT,
    new_value TEXT,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_node ON events(node_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

-- ─── Row Level Security (allow all for anon — personal app) ───
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE victory_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vc_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE levers ENABLE ROW LEVEL SECURITY;
ALTER TABLE principles ENABLE ROW LEVEL SECURITY;
ALTER TABLE captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Allow full access (single-user personal app)
CREATE POLICY "Allow all" ON statuses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON edges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON problems FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON victory_conditions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON vc_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON status_changes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON levers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON principles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON captures FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON events FOR ALL USING (true) WITH CHECK (true);
