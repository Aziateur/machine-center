import { useState, useCallback, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';

interface FlowState {
    nodes: Node[];
    edges: Edge[];
}

const MAX_HISTORY = 50;

export function useUndoRedo(
    flowNodes: Node[],
    flowEdges: Edge[],
    setFlowNodes: React.Dispatch<React.SetStateAction<Node[]>>,
    setFlowEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
) {
    const [past, setPast] = useState<FlowState[]>([]);
    const [future, setFuture] = useState<FlowState[]>([]);
    const isUndoRedo = useRef(false);
    const lastSaved = useRef<string>('');

    // Take a snapshot of current state (call before making changes)
    const takeSnapshot = useCallback(() => {
        if (isUndoRedo.current) return;
        const key = JSON.stringify({ n: flowNodes.map(n => ({ id: n.id, x: n.position.x, y: n.position.y })), e: flowEdges.map(e => e.id) });
        if (key === lastSaved.current) return; // skip duplicates
        lastSaved.current = key;
        setPast(prev => [...prev.slice(-(MAX_HISTORY - 1)), { nodes: structuredClone(flowNodes), edges: structuredClone(flowEdges) }]);
        setFuture([]);
    }, [flowNodes, flowEdges]);

    const undo = useCallback(() => {
        if (past.length === 0) return;
        isUndoRedo.current = true;
        const prev = past[past.length - 1];
        setPast(p => p.slice(0, -1));
        setFuture(f => [...f, { nodes: structuredClone(flowNodes), edges: structuredClone(flowEdges) }]);
        setFlowNodes(prev.nodes);
        setFlowEdges(prev.edges);
        setTimeout(() => { isUndoRedo.current = false; }, 50);
    }, [past, flowNodes, flowEdges, setFlowNodes, setFlowEdges]);

    const redo = useCallback(() => {
        if (future.length === 0) return;
        isUndoRedo.current = true;
        const next = future[future.length - 1];
        setFuture(f => f.slice(0, -1));
        setPast(p => [...p, { nodes: structuredClone(flowNodes), edges: structuredClone(flowEdges) }]);
        setFlowNodes(next.nodes);
        setFlowEdges(next.edges);
        setTimeout(() => { isUndoRedo.current = false; }, 50);
    }, [future, flowNodes, flowEdges, setFlowNodes, setFlowEdges]);

    return { undo, redo, takeSnapshot, canUndo: past.length > 0, canRedo: future.length > 0 };
}
