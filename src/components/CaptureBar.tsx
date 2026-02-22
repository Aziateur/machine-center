import { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, X, Check } from 'lucide-react';
import { db } from '../db';
import { v4 as uuid } from 'uuid';
import '../styles/capture-bar.css';

export default function CaptureBar() {
    const [isOpen, setIsOpen] = useState(false);
    const [text, setText] = useState('');
    const [flash, setFlash] = useState(false);
    const [unprocessedCount, setUnprocessedCount] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Count unprocessed captures
    useEffect(() => {
        const load = () => db.captures.filter(c => !c.processed).count().then(setUnprocessedCount);
        load();
        const interval = setInterval(load, 5000);
        return () => clearInterval(interval);
    }, []);

    // Keyboard shortcut: Cmd+.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === '.') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // Auto-focus
    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    const handleSubmit = useCallback(async () => {
        if (!text.trim()) return;

        // Get machineId from URL or localStorage
        const match = window.location.pathname.match(/\/machine\/([^/?]+)/);
        const machineId = match?.[1] || localStorage.getItem('lastViewedMachineId') || '';

        await db.captures.add({
            id: uuid(),
            text: text.trim(),
            machineId,
            processed: false,
            createdAt: new Date(),
        });

        setText('');
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
        setUnprocessedCount(prev => prev + 1);
    }, [text]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
        if (e.key === 'Escape') { setIsOpen(false); setText(''); }
    };

    return (
        <>
            {/* FAB button */}
            <button
                className={`capture-fab ${unprocessedCount > 0 ? 'has-items' : ''}`}
                onClick={() => setIsOpen(true)}
                title="Quick Capture (⌘.)"
            >
                <Zap size={20} />
                {unprocessedCount > 0 && (
                    <span className="capture-fab-badge">{unprocessedCount}</span>
                )}
            </button>

            {/* Capture input overlay */}
            {isOpen && (
                <div className="capture-overlay" onClick={() => { setIsOpen(false); setText(''); }}>
                    <div className="capture-bar" onClick={e => e.stopPropagation()}>
                        <div className="capture-bar-icon">
                            <Zap size={18} />
                        </div>
                        <input
                            ref={inputRef}
                            className="capture-input"
                            value={text}
                            onChange={e => setText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Capture a thought, observation, or idea..."
                        />
                        {text.trim() && (
                            <button className="capture-submit" onClick={handleSubmit}>
                                <Check size={16} /> Capture
                            </button>
                        )}
                        <button className="capture-close" onClick={() => { setIsOpen(false); setText(''); }}>
                            <X size={16} />
                        </button>
                    </div>
                    {flash && (
                        <div className="capture-flash">✓ Captured</div>
                    )}
                </div>
            )}
        </>
    );
}
