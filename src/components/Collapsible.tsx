import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface CollapsibleProps {
    title: string;
    badge?: string | number;
    badgeColor?: string;
    defaultOpen?: boolean;
    children: ReactNode;
    className?: string;
}

export default function Collapsible({ title, badge, badgeColor, defaultOpen = false, children, className = '' }: CollapsibleProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`collapsible ${isOpen ? 'open' : ''} ${className}`}>
            <button className="collapsible-header" onClick={() => setIsOpen(!isOpen)}>
                <ChevronRight size={14} className="collapsible-chevron" />
                <span className="collapsible-title">{title}</span>
                {badge !== undefined && badge !== 0 && (
                    <span
                        className="collapsible-badge"
                        style={badgeColor ? { background: `${badgeColor}20`, color: badgeColor } : {}}
                    >
                        {badge}
                    </span>
                )}
            </button>
            <div className="collapsible-body">
                <div className="collapsible-inner">
                    {children}
                </div>
            </div>
        </div>
    );
}
