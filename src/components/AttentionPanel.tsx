import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, Target, Zap, Inbox } from 'lucide-react';
import type { AttentionItem } from '../hooks/useDashboardScan';

const SEVERITY_ICONS: Record<string, string> = {
    critical: '🔴',
    red: '🔴',
    amber: '🟠',
    normal: '⚪',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
    'stale-problem': <AlertTriangle size={14} />,
    'blocked-machine': <Clock size={14} />,
    'unmet-vc': <Target size={14} />,
    'stale-node': <Zap size={14} />,
    'aging-capture': <Inbox size={14} />,
};

export default function AttentionPanel({ items, onDismissAll }: { items: AttentionItem[]; onDismissAll?: () => void }) {
    const navigate = useNavigate();

    if (items.length === 0) return null;

    return (
        <div className="attention-panel">
            <div className="attention-header">
                <span className="attention-title">🔥 Needs Attention</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="attention-count">{items.length}</span>
                    {onDismissAll && (
                        <button className="attention-dismiss-all" onClick={onDismissAll}>
                            Dismiss All
                        </button>
                    )}
                </div>
            </div>
            <div className="attention-list">
                {items.slice(0, 8).map(item => (
                    <button
                        key={item.id}
                        className={`attention-item severity-${item.severity}`}
                        onClick={() => navigate(item.link)}
                    >
                        <span className="attention-icon">{SEVERITY_ICONS[item.severity]}</span>
                        <div className="attention-info">
                            <span className="attention-item-title">
                                {TYPE_ICONS[item.type]} {item.title}
                            </span>
                            <span className="attention-item-subtitle">{item.subtitle}</span>
                        </div>
                        <span className="attention-age">{item.ageDays}d</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
