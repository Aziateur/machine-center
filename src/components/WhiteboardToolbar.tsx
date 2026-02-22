import {
    MousePointer2, Hand, Plus, Undo2, Redo2, Maximize,
    HelpCircle, Copy, Clipboard, Trash2, Search,
} from 'lucide-react';

export type ToolMode = 'select' | 'pan';

interface WhiteboardToolbarProps {
    mode: ToolMode;
    onModeChange: (mode: ToolMode) => void;
    onAddNode: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onFitView: () => void;
    onCopy: () => void;
    onPaste: () => void;
    onDelete: () => void;
    onSearch: () => void;
    onHelp: () => void;
    canUndo: boolean;
    canRedo: boolean;
    hasSelection: boolean;
}

export default function WhiteboardToolbar({
    mode, onModeChange, onAddNode,
    onUndo, onRedo, onFitView,
    onCopy, onPaste, onDelete, onSearch, onHelp,
    canUndo, canRedo, hasSelection,
}: WhiteboardToolbarProps) {
    return (
        <div className="wb-toolbar">
            <div className="wb-toolbar-group">
                <button
                    className={`wb-tool-btn ${mode === 'select' ? 'active' : ''}`}
                    onClick={() => onModeChange('select')}
                    title="Select (V)"
                >
                    <MousePointer2 size={16} />
                </button>
                <button
                    className={`wb-tool-btn ${mode === 'pan' ? 'active' : ''}`}
                    onClick={() => onModeChange('pan')}
                    title="Pan (H)"
                >
                    <Hand size={16} />
                </button>
            </div>

            <div className="wb-toolbar-divider" />

            <div className="wb-toolbar-group">
                <button className="wb-tool-btn" onClick={onAddNode} title="Add Node (+)">
                    <Plus size={16} />
                </button>
            </div>

            <div className="wb-toolbar-divider" />

            <div className="wb-toolbar-group">
                <button className="wb-tool-btn" onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)">
                    <Undo2 size={16} />
                </button>
                <button className="wb-tool-btn" onClick={onRedo} disabled={!canRedo} title="Redo (⌘⇧Z)">
                    <Redo2 size={16} />
                </button>
            </div>

            <div className="wb-toolbar-divider" />

            <div className="wb-toolbar-group">
                <button className="wb-tool-btn" onClick={onCopy} disabled={!hasSelection} title="Copy (⌘C)">
                    <Copy size={16} />
                </button>
                <button className="wb-tool-btn" onClick={onPaste} title="Paste (⌘V)">
                    <Clipboard size={16} />
                </button>
                <button className="wb-tool-btn danger" onClick={onDelete} disabled={!hasSelection} title="Delete (⌫)">
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="wb-toolbar-divider" />

            <div className="wb-toolbar-group">
                <button className="wb-tool-btn" onClick={onFitView} title="Fit View (0)">
                    <Maximize size={16} />
                </button>
                <button className="wb-tool-btn" onClick={onSearch} title="Search (⌘F)">
                    <Search size={16} />
                </button>
            </div>

            <div className="wb-toolbar-divider" />

            <button className="wb-tool-btn help" onClick={onHelp} title="Shortcuts (?)">
                <HelpCircle size={16} />
            </button>
        </div>
    );
}
