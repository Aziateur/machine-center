import { X } from 'lucide-react';

const SHORTCUTS = [
    { section: 'Selection' },
    { keys: 'Click + Drag', action: 'Rectangle select (in Select mode)' },
    { keys: 'Shift + Click', action: 'Add/remove from selection' },
    { keys: '⌘A', action: 'Select all nodes' },
    { keys: 'Escape', action: 'Deselect all' },

    { section: 'Tools' },
    { keys: 'V', action: 'Switch to Select mode' },
    { keys: 'H', action: 'Switch to Pan mode' },
    { keys: 'Hold Space', action: 'Temporary pan mode' },

    { section: 'Edit' },
    { keys: '⌘Z', action: 'Undo' },
    { keys: '⌘⇧Z', action: 'Redo' },
    { keys: '⌘C', action: 'Copy selected nodes' },
    { keys: '⌘V', action: 'Paste nodes' },
    { keys: '⌘D', action: 'Duplicate selected' },
    { keys: 'Delete / ⌫', action: 'Delete selected' },
    { keys: 'Double-click', action: 'Rename node' },

    { section: 'View' },
    { keys: '0', action: 'Zoom to fit' },
    { keys: '⌘ +', action: 'Zoom in' },
    { keys: '⌘ -', action: 'Zoom out' },
    { keys: '⌘F', action: 'Search nodes' },

    { section: 'Nodes' },
    { keys: '⌘J', action: 'Quick status change' },
    { keys: '+', action: 'Add new node' },
];

interface ShortcutsHelpProps {
    onClose: () => void;
}

export default function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
    return (
        <div className="shortcuts-help-overlay" onClick={onClose}>
            <div className="shortcuts-help-modal" onClick={e => e.stopPropagation()}>
                <div className="shortcuts-help-header">
                    <h2>Keyboard Shortcuts</h2>
                    <button className="shortcuts-help-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>
                <div className="shortcuts-help-body">
                    {SHORTCUTS.map((item, i) => {
                        if ('section' in item && !('keys' in item)) {
                            return <div key={i} className="shortcuts-section-title">{item.section}</div>;
                        }
                        if ('keys' in item && 'action' in item) {
                            return (
                                <div key={i} className="shortcuts-row">
                                    <span className="shortcuts-keys">{item.keys}</span>
                                    <span className="shortcuts-action">{item.action}</span>
                                </div>
                            );
                        }
                        return null;
                    })}
                </div>
            </div>
        </div>
    );
}
