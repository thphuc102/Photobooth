import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LayoutOption, Placeholder } from '../types';
import TemplateDesigner from './TemplateDesigner';
import { XIcon } from './icons';

interface LayoutEditorModalProps {
    layout: LayoutOption | undefined;
    onClose: () => void;
    onSave: (placeholders: Placeholder[]) => void;
}

const DEBOUNCE_MS = 250;

const LayoutEditorModal: React.FC<LayoutEditorModalProps> = ({ layout, onClose, onSave }) => {
    const [pendingPlaceholders, setPendingPlaceholders] = useState<Placeholder[]>(layout ? layout.placeholders : []);
    const debounceTimer = useRef<number | null>(null);
    const historyRef = useRef<Placeholder[][]>(layout ? [layout.placeholders] : []);
    const historyIndexRef = useRef<number>(0);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    useEffect(() => {
        if (layout) {
            setPendingPlaceholders(layout.placeholders);
            historyRef.current = [layout.placeholders];
            historyIndexRef.current = 0;
            setCanUndo(false);
            setCanRedo(false);
        }
    }, [layout]);

    const commitPlaceholders = useCallback((ph: Placeholder[]) => {
        onSave(ph); // Persist to parent (versioning handled upstream)
    }, [onSave]);

    const scheduleSave = useCallback((next: Placeholder[]) => {
        if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
        debounceTimer.current = window.setTimeout(() => {
            commitPlaceholders(next);
        }, DEBOUNCE_MS);
    }, [commitPlaceholders]);

    const handlePlaceholdersChange = (next: Placeholder[]) => {
        setPendingPlaceholders(next);
        // Push to history only if different from current index
        const current = historyRef.current[historyIndexRef.current];
        const changed = JSON.stringify(current) !== JSON.stringify(next);
        if (changed) {
            const sliced = historyRef.current.slice(0, historyIndexRef.current + 1);
            sliced.push(next);
            historyRef.current = sliced;
            historyIndexRef.current = sliced.length - 1;
            setCanUndo(historyIndexRef.current > 0);
            setCanRedo(false);
        }
        scheduleSave(next);
    };

    const undo = () => {
        if (historyIndexRef.current > 0) {
            historyIndexRef.current -= 1;
            const prev = historyRef.current[historyIndexRef.current];
            setPendingPlaceholders(prev);
            commitPlaceholders(prev); // immediate commit on undo
            setCanUndo(historyIndexRef.current > 0);
            setCanRedo(true);
        }
    };

    const redo = () => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current += 1;
            const next = historyRef.current[historyIndexRef.current];
            setPendingPlaceholders(next);
            commitPlaceholders(next);
            setCanUndo(true);
            setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
        }
    };

    if (!layout) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80" aria-modal="true">
            <div className="relative w-full h-full bg-gray-900 flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-bold text-white">Edit Layout Placeholders</h2>
                        <p className="text-sm text-gray-400 mt-1">{layout.label}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={undo}
                            disabled={!canUndo}
                            className={`px-3 py-1 rounded text-xs font-semibold ${canUndo ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                        >Undo</button>
                        <button
                            onClick={redo}
                            disabled={!canRedo}
                            className={`px-3 py-1 rounded text-xs font-semibold ${canRedo ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                        >Redo</button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                            title="Close"
                        >
                            <XIcon className="w-6 h-6 text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Template Designer */}
                <div className="flex-1 overflow-hidden">
                    <TemplateDesigner
                        frameSrc={null}
                        onTemplateConfirm={() => { }}
                        embedded={true}
                        initialPlaceholders={layout.placeholders}
                        onPlaceholdersChange={handlePlaceholdersChange}
                    />
                </div>

                {/* Footer with instructions */}
                <div className="p-4 border-t border-gray-700 bg-gray-800">
                    <div className="flex flex-col items-center gap-1 text-center">
                        <p className="text-sm text-gray-400">💡 Drag and resize placeholders. Changes auto-saved (debounced {DEBOUNCE_MS}ms).</p>
                        <p className="text-xs text-gray-500">History depth: {historyRef.current.length} | Current index: {historyIndexRef.current + 1}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LayoutEditorModal;
