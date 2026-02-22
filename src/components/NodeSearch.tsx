import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import type { MachineNode } from '../types';
import { NODE_TYPE_CONFIG } from '../types';

interface NodeSearchProps {
    nodes: MachineNode[];
    onSelect: (nodeId: string) => void;
    onClose: () => void;
}

export default function NodeSearch({ nodes, onSelect, onClose }: NodeSearchProps) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const filtered = query.length > 0
        ? nodes.filter(n =>
            n.label.toLowerCase().includes(query.toLowerCase()) ||
            n.goal?.toLowerCase().includes(query.toLowerCase()) ||
            n.description?.toLowerCase().includes(query.toLowerCase())
        )
        : nodes;

    return (
        <div className="node-search-overlay" onClick={onClose}>
            <div className="node-search-modal" onClick={e => e.stopPropagation()}>
                <div className="node-search-input-row">
                    <Search size={16} />
                    <input
                        ref={inputRef}
                        className="node-search-input"
                        placeholder="Search nodes..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Escape') onClose();
                            if (e.key === 'Enter' && filtered.length > 0) {
                                onSelect(filtered[0].id);
                                onClose();
                            }
                        }}
                    />
                    <button className="node-search-close" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>
                <div className="node-search-results">
                    {filtered.map(n => {
                        const config = NODE_TYPE_CONFIG[n.type];
                        return (
                            <button
                                key={n.id}
                                className="node-search-result"
                                onClick={() => { onSelect(n.id); onClose(); }}
                            >
                                <span className="node-search-icon" style={{ color: config?.color }}>{config?.icon}</span>
                                <span className="node-search-label">{n.label}</span>
                                <span className="node-search-type">{config?.label}</span>
                            </button>
                        );
                    })}
                    {filtered.length === 0 && (
                        <div className="node-search-empty">No nodes found</div>
                    )}
                </div>
            </div>
        </div>
    );
}
