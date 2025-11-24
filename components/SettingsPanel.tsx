import React, { useState, useEffect, useRef } from 'react';
import { Printer, AppSettings, OrganizerSettings, AnalyticsData, Placeholder } from '../types';
import FrameUploader from './FrameUploader'; // Import FrameUploader
import { GoogleDriveIcon, UploadIcon, FolderIcon, ServerIcon, ChipIcon, SwatchIcon } from './icons';
import LayoutEditorModal from './LayoutEditorModal';
import { listLayoutPlugins, setLayoutPluginEnabled } from '../plugins/layoutRegistry';
import { t } from '../i18n/i18n';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    onSettingsChange: (newSettings: AppSettings) => void;
    analytics?: AnalyticsData;
    currentGuestLayoutId?: string | null;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, settings, onSettingsChange, analytics, currentGuestLayoutId }) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [activeTab, setActiveTab] = useState<'general' | 'layouts' | 'pro'>('general');
    const frameInputRef = useRef<HTMLInputElement>(null);
    const iccInputRef = useRef<HTMLInputElement>(null);

    // New Printer State
    const [newPrinterName, setNewPrinterName] = useState('');
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [editingLayoutId, setEditingLayoutId] = useState<string | null>(null);

    // Layout validation constants & helpers
    const MIN_PLACEHOLDER_SIZE = 0.05; // relative (5% of canvas)
    const validatePlaceholders = (placeholders: Placeholder[]): Placeholder[] => {
        return placeholders.map(p => {
            let width = Math.max(MIN_PLACEHOLDER_SIZE, Math.min(1, p.width));
            let height = Math.max(MIN_PLACEHOLDER_SIZE, Math.min(1, p.height));
            let x = Math.max(0, Math.min(1 - width, p.x));
            let y = Math.max(0, Math.min(1 - height, p.y));
            return { ...p, x, y, width, height };
        });
    };

    const revertLayoutVersion = (layoutId: string) => {
        setLocalSettings(prev => {
            const updated = prev.layoutOptions.map(l => {
                if (l.id === layoutId && l.versions && l.versions.length > 0) {
                    const last = l.versions[l.versions.length - 1];
                    // Push current state before revert for audit trail
                    const versions = [...l.versions, { timestamp: Date.now(), placeholders: l.placeholders, note: 'pre-revert snapshot' }];
                    return { ...l, placeholders: last.placeholders, versions };
                }
                return l;
            });
            return { ...prev, layoutOptions: updated };
        });
    };

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSettingsChange(localSettings);
        onClose();
    };

    const handleSettingChange = (field: keyof AppSettings, value: any) => {
        setLocalSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleProSettingChange = (field: keyof AppSettings['pro'], value: any) => {
        setLocalSettings(prev => ({ ...prev, pro: { ...prev.pro, [field]: value } }));
    };

    const handleSelectHotFolder = async () => {
        try {
            if (!('showDirectoryPicker' in window)) {
                alert('Your browser does not support local folder access. Please use a modern browser like Chrome or Edge.');
                return;
            }
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            setLocalSettings(prev => ({ ...prev, hotFolderHandle: handle, hotFolderName: handle.name }));
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                console.error('Error selecting directory:', err);
            }
        }
    };

    const handleSelectOutputFolder = async () => {
        try {
            if (!('showDirectoryPicker' in window)) {
                alert('Your browser does not support local folder access. Please use a modern browser like Chrome or Edge.');
                return;
            }
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            setLocalSettings(prev => ({ ...prev, outputDirectoryHandle: handle, localDownloadPath: handle.name }));
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                console.error('Error selecting directory:', err);
            }
        }
    };

    const handleFrameFileChange = (file: File, selectedLayoutIds: string[]) => {
        const url = URL.createObjectURL(file);
        const newFrameConfig: import('../types').FrameConfig = {
            id: Date.now().toString(),
            name: file.name.replace('.png', ''),
            thumbnailSrc: url,
            isVisible: true,
            supportedLayouts: (localSettings.layoutOptions || [])
                .filter(l => selectedLayoutIds.includes(l.id))
                .map(l => ({
                    layoutId: l.id,
                    placeholders: l.placeholders,
                    overlaySrc: url
                }))
        };
        setLocalSettings(prev => ({
            ...prev,
            frameSrc: url,
            availableFrames: [...prev.availableFrames, newFrameConfig]
        }));
    };

    const handleRemoveLayout = (id: string) => {
        setLocalSettings(prev => ({
            ...prev,
            layoutOptions: prev.layoutOptions.filter(l => l.id !== id)
        }));
    };

    // Heuristic layout suggestion generator
    const generateSuggestedLayouts = () => {
        const suggestions: import('../types').LayoutOption[] = [];
        const baseId = Date.now();
        const margin = 0.05;
        const gap = 0.03;
        const availW = 1 - margin * 2;
        const availH = 1 - margin * 2;

        const makeGrid = (rows: number, cols: number, aspect: string | null = null, note: string) => {
            const w = (availW - gap * (cols - 1)) / cols;
            const h = (availH - gap * (rows - 1)) / rows;
            const placeholders: Placeholder[] = [];
            let idCounter = baseId + suggestions.length * 1000;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    placeholders.push({
                        id: idCounter++,
                        x: margin + c * (w + gap),
                        y: margin + r * (h + gap),
                        width: w,
                        height: h,
                        aspectRatio: aspect,
                        fit: 'cover'
                    });
                }
            }
            suggestions.push({
                id: `suggest-${rows}x${cols}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
                label: `${rows}x${cols} Balanced (${note})`,
                type: 'custom',
                placeholders,
                isActive: true,
                iconType: 'custom',
                versions: [{ timestamp: Date.now(), placeholders, note: 'generated' }]
            });
        };

        makeGrid(1, 2, '3/2', 'landscape pair');
        makeGrid(2, 3, null, 'social collage');
        makeGrid(3, 3, null, 'nine grid');
        makeGrid(2, 4, '3/4', 'dense eight');
        makeGrid(1, 3, '2/3', 'strip alt');

        setLocalSettings(prev => ({ ...prev, layoutOptions: [...prev.layoutOptions, ...suggestions] }));
    };

    // Security: sanitize values before export
    const exportLayoutsAndFrames = () => {
        const payload = {
            layoutOptions: localSettings.layoutOptions,
            availableFrames: localSettings.availableFrames
        };
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `photobooth-config-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const sanitizeNumber = (v: any, fallback: number, min: number, max: number) => {
        const num = typeof v === 'number' && isFinite(v) ? v : fallback;
        return Math.min(max, Math.max(min, num));
    };

    const sanitizePlaceholders = (phs: any[]): Placeholder[] => {
        return phs.filter(p => p && typeof p === 'object').map(p => ({
            id: typeof p.id === 'number' ? p.id : Date.now(),
            x: sanitizeNumber(p.x, 0, 0, 1),
            y: sanitizeNumber(p.y, 0, 0, 1),
            width: sanitizeNumber(p.width, 0.2, 0.01, 1),
            height: sanitizeNumber(p.height, 0.2, 0.01, 1),
            aspectRatio: typeof p.aspectRatio === 'string' || p.aspectRatio === null ? p.aspectRatio : null,
            fit: p.fit === 'contain' ? 'contain' : 'cover'
        }));
    };

    const importLayoutsAndFrames = (file: File) => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const text = e.target?.result as string;
                const parsed = JSON.parse(text);
                if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON root');
                const { layoutOptions, availableFrames } = parsed;
                if (!Array.isArray(layoutOptions) || !Array.isArray(availableFrames)) throw new Error('Missing arrays');
                const sanitizedLayoutOptions = layoutOptions.filter((l: any) => l && Array.isArray(l.placeholders)).map((l: any) => ({
                    id: String(l.id || 'import-' + Date.now() + Math.random()),
                    label: String(l.label || 'Imported Layout'),
                    type: l.type === 'preset' ? 'preset' : 'custom',
                    placeholders: sanitizePlaceholders(l.placeholders),
                    isActive: !!l.isActive,
                    iconType: ['single','grid','strip','custom'].includes(l.iconType) ? l.iconType : 'custom',
                    versions: Array.isArray(l.versions) ? l.versions.slice(0,10).map((v: any) => ({
                        timestamp: typeof v.timestamp === 'number' ? v.timestamp : Date.now(),
                        placeholders: sanitizePlaceholders(v.placeholders || []),
                        note: typeof v.note === 'string' ? v.note : undefined
                    })) : []
                }));
                const sanitizedFrames = availableFrames.filter((f: any) => f && Array.isArray(f.supportedLayouts)).map((f: any) => ({
                    id: String(f.id || 'frame-' + Date.now() + Math.random()),
                    name: String(f.name || 'Imported Frame'),
                    thumbnailSrc: String(f.thumbnailSrc || ''),
                    isVisible: !!f.isVisible,
                    supportedLayouts: f.supportedLayouts.filter((sl: any) => sl && Array.isArray(sl.placeholders)).map((sl: any) => ({
                        layoutId: String(sl.layoutId || 'missing'),
                        placeholders: sanitizePlaceholders(sl.placeholders),
                        overlaySrc: typeof sl.overlaySrc === 'string' ? sl.overlaySrc : undefined
                    }))
                }));
                setLocalSettings(prev => ({
                    ...prev,
                    layoutOptions: sanitizedLayoutOptions,
                    availableFrames: sanitizedFrames
                }));
            } catch (err) {
                alert('Failed to import configuration: ' + (err as Error).message);
            }
        };
        reader.readAsText(file);
    };

    const importFileInputRef = useRef<HTMLInputElement>(null);

    const renderLayoutSettings = () => (
        <div className="space-y-4">
            {currentGuestLayoutId && (
                <div className="p-4 rounded-lg border border-indigo-600 bg-indigo-900/30">
                    <p className="text-sm text-indigo-200">Guest selected layout: <strong>{localSettings.layoutOptions.find(l => l.id === currentGuestLayoutId)?.label || currentGuestLayoutId}</strong></p>
                    <button
                        onClick={() => { setEditingLayoutId(currentGuestLayoutId); setIsEditingLayout(true); }}
                        className="mt-2 px-3 py-2 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                    >Edit Active Layout</button>
                    {currentGuestLayoutId && localSettings.layoutOptions.find(l => l.id === currentGuestLayoutId)?.versions?.length ? (
                        <button
                            onClick={() => revertLayoutVersion(currentGuestLayoutId)}
                            className="mt-2 ml-2 px-3 py-2 text-xs font-semibold rounded bg-yellow-600 hover:bg-yellow-500 text-white"
                        >Revert Active</button>
                    ) : null}
                </div>
            )}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-white">{t('layoutPresets')}</h3>
                <div className="flex gap-2">
                    <button
                        onClick={generateSuggestedLayouts}
                        className="px-3 py-2 text-xs rounded bg-purple-600 hover:bg-purple-500 text-white font-semibold"
                    >{t('generateSuggestions')}</button>
                    <button
                        onClick={exportLayoutsAndFrames}
                        className="px-3 py-2 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                    >{t('exportJson')}</button>
                    <button
                        onClick={() => importFileInputRef.current?.click()}
                        className="px-3 py-2 text-xs rounded bg-teal-600 hover:bg-teal-500 text-white font-semibold"
                    >{t('importJson')}</button>
                    <input
                        type="file"
                        accept="application/json"
                        ref={importFileInputRef}
                        onChange={e => { const f = e.target.files?.[0]; if (f) importLayoutsAndFrames(f); e.target.value=''; }}
                        className="hidden"
                    />
                    {/* Update checker */}
                    <button
                      onClick={() => alert('Stub: would fetch remote manifest and compare.')}
                      className="px-3 py-2 text-xs rounded bg-indigo-700 hover:bg-indigo-600 text-white font-semibold"
                    >{t('updateCheck')}</button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-gray-800 text-gray-200 uppercase font-medium">
                        <tr>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Slots</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {localSettings.layoutOptions.map(layout => (
                            <tr key={layout.id} className="hover:bg-gray-800/50">
                                <td className="px-4 py-3 font-medium text-white">{layout.label}</td>
                                <td className="px-4 py-3">{layout.type}</td>
                                <td className="px-4 py-3">{layout.placeholders.length}</td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => handleEditGlobalLayout(layout.id)}
                                            className="text-indigo-400 hover:text-indigo-300"
                                            aria-label={`Edit layout ${layout.label}`}
                                        >
                                            {t('edit')}
                                        </button>
                                        {layout.versions && layout.versions.length > 0 && (
                                            <button
                                                onClick={() => revertLayoutVersion(layout.id)}
                                                className="text-yellow-400 hover:text-yellow-300"
                                                title="Revert to previous version"
                                            >{t('revert')}</button>
                                        )}
                                        {layout.type === 'custom' && (
                                            <button
                                                onClick={() => handleRemoveLayout(layout.id)}
                                                className="text-red-400 hover:text-red-300"
                                                title="Delete Layout"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
                        {/* Plugin & Diff Section */}
                                                <div className="mt-6 p-4 rounded-lg border border-gray-700 bg-gray-800/60 space-y-4">
                                                        <h4 className="text-sm font-semibold text-white flex items-center justify-between">{t('layoutPlugins')}
                                                                <button
                                                                    onClick={() => {
                                                                        // AI semantic suggestion placeholder: create layout with varied aspect ratios
                                                                        const ts = Date.now();
                                                                        const placeholders: Placeholder[] = [
                                                                            { id: ts+1, x:0.05, y:0.05, width:0.4, height:0.5, aspectRatio:'2/3', fit:'cover' },
                                                                            { id: ts+2, x:0.5, y:0.05, width:0.45, height:0.3, aspectRatio:'16/9', fit:'cover' },
                                                                            { id: ts+3, x:0.5, y:0.38, width:0.45, height:0.17, aspectRatio:null, fit:'cover' },
                                                                            { id: ts+4, x:0.05, y:0.6, width:0.25, height:0.35, aspectRatio:'1/1', fit:'cover' },
                                                                            { id: ts+5, x:0.32, y:0.6, width:0.28, height:0.35, aspectRatio:'4/5', fit:'cover' },
                                                                            { id: ts+6, x:0.62, y:0.6, width:0.33, height:0.35, aspectRatio:'3/4', fit:'cover' }
                                                                        ];
                                                                        const newLayout: import('../types').LayoutOption = {
                                                                            id: `ai-suggest-${ts}`,
                                                                            label: 'AI Semantic Mix',
                                                                            type: 'custom',
                                                                            placeholders,
                                                                            isActive: true,
                                                                            iconType: 'custom',
                                                                            versions: [{ timestamp: ts, placeholders, note: 'ai-suggest' }]
                                                                        };
                                                                        setLocalSettings(prev => ({ ...prev, layoutOptions: [...prev.layoutOptions, newLayout] }));
                                                                    }}
                                                                    className="px-3 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                                                                >{t('aiSuggestLayout')}</button>
                                                        </h4>
                                                        <div className="space-y-2">
                                                                {listLayoutPlugins().map(p => (
                                                                        <div key={p.id} className="flex items-center justify-between bg-gray-900 px-3 py-2 rounded">
                                                                                <div className="flex flex-col">
                                                                                        <span className="text-xs text-white font-semibold">{p.label}</span>
                                                                                        <span className="text-[10px] text-gray-400">v{p.version}</span>
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                        <button
                                                                                            onClick={() => setLayoutPluginEnabled(p.id, !p.enabled)}
                                                                                            className={`px-2 py-1 text-[10px] rounded ${p.enabled ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-700 hover:bg-gray-600'} text-white`}
                                                                                        >{p.enabled ? t('disablePlugin') : t('enablePlugin')}</button>
                                                                                        <button
                                                                                            disabled={!p.enabled || !p.generate}
                                                                                            onClick={() => {
                                                                                                if (!p.enabled || !p.generate) return;
                                                                                                const result = p.generate({ existingLayouts: localSettings.layoutOptions, canvasAspectRatio: localSettings.aspectRatio });
                                                                                                if (result.placeholders.length) {
                                                                                                    const newLayout: import('../types').LayoutOption = {
                                                                                                        id: `plugin-${p.id}-${Date.now()}`,
                                                                                                        label: p.label,
                                                                                                        type: 'custom',
                                                                                                        placeholders: result.placeholders,
                                                                                                        isActive: true,
                                                                                                        iconType: 'custom',
                                                                                                        versions: [{ timestamp: Date.now(), placeholders: result.placeholders, note: 'plugin-gen' }]
                                                                                                    };
                                                                                                    setLocalSettings(prev => ({ ...prev, layoutOptions: [...prev.layoutOptions, newLayout] }));
                                                                                                }
                                                                                            }}
                                                                                            className={`px-2 py-1 text-[10px] rounded ${p.enabled ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-800 text-gray-500'} disabled:opacity-50`}
                                                                                        >Run</button>
                                                                                </div>
                                                                        </div>
                                                                ))}
                                                        </div>
                            <button
                                onClick={() => {
                                    // Simple diff: compare counts & first placeholder changes
                                    const originalMap = new Map(settings.layoutOptions.map(l => [l.id, l]));
                                    const diffs: string[] = [];
                                    localSettings.layoutOptions.forEach(l => {
                                        const orig = originalMap.get(l.id);
                                        if (!orig) diffs.push(`+ Added layout ${l.label}`);
                                        else if (orig.placeholders.length !== l.placeholders.length) diffs.push(`* ${l.label} slot count ${orig.placeholders.length} -> ${l.placeholders.length}`);
                                        else {
                                            // Check first placeholder shift
                                            if (orig.placeholders[0] && l.placeholders[0]) {
                                                const dx = Math.abs(orig.placeholders[0].x - l.placeholders[0].x);
                                                const dy = Math.abs(orig.placeholders[0].y - l.placeholders[0].y);
                                                if (dx > 0.001 || dy > 0.001) diffs.push(`* ${l.label} first slot moved`);
                                            }
                                        }
                                    });
                                    originalMap.forEach((v, k) => { if (!localSettings.layoutOptions.find(l => l.id === k)) diffs.push(`- Removed layout ${v.label}`); });
                                    alert(diffs.length ? diffs.join('\n') : 'No structural layout differences detected.');
                                }}
                                className="mt-2 px-3 py-2 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white font-semibold"
                            >{t('diffLayouts')}</button>
                        </div>
        </div>
    );

const renderProSettings = () => (
    <div className="space-y-6">
        {/* Vending / MDB */}
        <div className="p-4 bg-black/20 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold flex items-center gap-2 text-yellow-400">
                    <ChipIcon className="w-5 h-5" /> Vending & Payment (MDB)
                </h4>
                <label className="flex items-center cursor-pointer">
                    <div className="relative">
                        <input type="checkbox" className="sr-only" checked={localSettings.pro.enableVending} onChange={(e) => handleProSettingChange('enableVending', e.target.checked)} />
                        <div className={`block w-10 h-6 rounded-full ${localSettings.pro.enableVending ? 'bg-yellow-500' : 'bg-gray-600'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${localSettings.pro.enableVending ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                </label>
            </div>

            {localSettings.pro.enableVending && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Price per Print</label>
                            <input type="number" value={localSettings.pro.pricePerPrint} onChange={(e) => handleProSettingChange('pricePerPrint', parseFloat(e.target.value))} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Currency Symbol</label>
                            <input type="text" value={localSettings.pro.currency} onChange={(e) => handleProSettingChange('currency', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm" />
                        </div>
                    </div>
                    <button className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs flex items-center justify-center gap-2">
                        <ChipIcon className="w-4 h-4" /> Connect Serial Adapter (Web Serial)
                    </button>
                </div>
            )}
        </div>

        {/* Printer Pooling */}
        <div className="p-4 bg-black/20 rounded-lg border border-gray-700">
            <h4 className="text-sm font-bold flex items-center gap-2 text-blue-400 mb-4">
                <ServerIcon className="w-5 h-5" /> Printer Pooling (Node.js Queue)
            </h4>

            <div className="space-y-2 mb-4">
                {localSettings.pro.printerPool.map(printer => (
                    <div key={printer.id} className="flex items-center justify-between bg-gray-900 p-2 rounded">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${printer.status === 'idle' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className="text-sm">{printer.name}</span>
                            <span className="text-xs text-gray-500">({printer.jobs} jobs)</span>
                        </div>
                        <button onClick={() => removePrinter(printer.id)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                    </div>
                ))}
                {localSettings.pro.printerPool.length === 0 && <p className="text-xs text-gray-500">No printers configured.</p>}
            </div>

            <div className="flex gap-2">
                <input type="text" placeholder="Printer Name / IP" value={newPrinterName} onChange={(e) => setNewPrinterName(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-sm" />
                <button onClick={addPrinter} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm">Add</button>
            </div>
        </div>

        {/* Smart Crop & Color */}
        <div className="p-4 bg-black/20 rounded-lg border border-gray-700 space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold flex items-center gap-2 text-pink-400">
                    <SwatchIcon className="w-5 h-5" /> Color & AI
                </h4>
            </div>

            <div className="flex items-center justify-between">
                <label className="text-sm text-gray-300">Enable Smart Crop (Face Detection)</label>
                <input type="checkbox" checked={localSettings.pro.enableSmartCrop} onChange={(e) => handleProSettingChange('enableSmartCrop', e.target.checked)} className="rounded bg-gray-900 border-gray-700 text-pink-500 focus:ring-pink-500" />
            </div>

            <div>
                <label className="block text-xs text-gray-400 mb-1">Live View Cinematic LUT (CSS Filter)</label>
                <select value={localSettings.pro.liveViewLut} onChange={(e) => handleProSettingChange('liveViewLut', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm">
                    <option value="">None (Standard)</option>
                    <option value="sepia(0.3) contrast(1.1)">Warm Vintage</option>
                    <option value="contrast(1.2) saturate(1.2)">High Contrast Pop</option>
                    <option value="grayscale(1) contrast(1.2)">Noir B&W</option>
                    <option value="saturate(1.5) hue-rotate(-10deg)">Cyberpunk</option>
                </select>
            </div>

            <div>
                <label className="block text-xs text-gray-400 mb-1">ICC Profile</label>
                <div className="flex gap-2">
                    <div className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-gray-400 truncate">
                        <button onClick={() => iccInputRef.current?.click()} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs">Load .ICC</button>
                        <input type="file" ref={iccInputRef} onChange={handleIccFileChange} className="hidden" />
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const handleLayoutSelectForEditing = (layoutId: string) => {
    if (!localSettings.frameSrc) return;
    const frame = (localSettings.availableFrames || []).find(f => f.thumbnailSrc === localSettings.frameSrc);
    if (frame) {
        const layoutConfig = frame.supportedLayouts.find(sl => sl.layoutId === layoutId);
        if (layoutConfig) {
            handleSettingChange('placeholders', layoutConfig.placeholders);
        } else {
            // If layout not supported yet, maybe load default from global options?
            const globalLayout = localSettings.layoutOptions.find(l => l.id === layoutId);
            if (globalLayout) {
                handleSettingChange('placeholders', globalLayout.placeholders);
            }
        }
    }
};

const handleEditGlobalLayout = (layoutId: string) => {
    setEditingLayoutId(layoutId);
    setIsEditingLayout(true);
};

const handleSaveLayoutPlaceholders = (placeholders: Placeholder[]) => {
    if (!editingLayoutId) return;
    const validated = validatePlaceholders(placeholders);
    const updatedLayouts = localSettings.layoutOptions.map(l => {
        if (l.id === editingLayoutId) {
            const versions = [...(l.versions || []), { timestamp: Date.now(), placeholders: l.placeholders, note: 'edit' }];
            return { ...l, placeholders: validated, versions };
        }
        return l;
    });
    handleSettingChange('layoutOptions', updatedLayouts);
    if (currentGuestLayoutId && currentGuestLayoutId === editingLayoutId) {
        handleSettingChange('placeholders', validated);
    }
};

    const handleSetDefaultFrame = (frame: import('../types').FrameConfig) => {
        handleSettingChange('frameSrc', frame.thumbnailSrc);
    };

    const handleRemoveFrame = (index: number) => {
        const newFrames = [...localSettings.availableFrames];
        newFrames.splice(index, 1);
        handleSettingChange('availableFrames', newFrames);
        if (localSettings.availableFrames[index] && localSettings.frameSrc === localSettings.availableFrames[index].thumbnailSrc) {
            handleSettingChange('frameSrc', null);
        }
    };    const addPrinter = () => {
        if (!newPrinterName.trim()) return;
        const newPrinter: Printer = {
            id: Date.now().toString(),
            name: newPrinterName,
            status: 'idle',
            jobs: 0
        };
        handleProSettingChange('printerPool', [...localSettings.pro.printerPool, newPrinter]);
        setNewPrinterName('');
    };

    const removePrinter = (id: string) => {
        handleProSettingChange('printerPool', localSettings.pro.printerPool.filter(p => p.id !== id));
    };

    const handleIccFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleProSettingChange('iccProfileName', file.name);
        }
    };

    const renderGeneralSettings = () => (
        <div className="space-y-6">
             <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <h3 className="text-lg font-medium text-white mb-4">Directories & Locale</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Hot Folder (Input)</label>
                        <div className="flex gap-2">
                            <input type="text" readOnly value={localSettings.hotFolderName || ''} className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-300 text-sm" placeholder="No folder selected" />
                            <button onClick={handleSelectHotFolder} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white flex items-center gap-2">
                                <FolderIcon className="w-4 h-4" /> Browse
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Output Folder (Save)</label>
                        <div className="flex gap-2">
                            <input type="text" readOnly value={localSettings.localDownloadPath || ''} className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-300 text-sm" placeholder="Default (Downloads)" />
                            <button onClick={handleSelectOutputFolder} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white flex items-center gap-2">
                                <FolderIcon className="w-4 h-4" /> Browse
                            </button>
                        </div>
                    </div>
                                        <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-1">Locale</label>
                                                <select
                                                    value={localSettings.locale || 'en'}
                                                    onChange={(e) => handleSettingChange('locale', e.target.value)}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-300 text-sm"
                                                >
                                                    <option value="en">English</option>
                                                    <option value="vi">Tiếng Việt</option>
                                                </select>
                                        </div>
                </div>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <h3 className="text-lg font-medium text-white mb-4">Kiosk Mode</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Enable Kiosk Lock</span>
                        <input
                            type="checkbox"
                            checked={!!localSettings.kioskMode}
                            onChange={(e) => handleSettingChange('kioskMode', e.target.checked)}
                        />
                    </div>
                    {localSettings.kioskMode && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Auto Lock (seconds)</label>
                                <input
                                    type="number"
                                    min={30}
                                    value={localSettings.autoResetTimer || 120}
                                    onChange={(e) => handleSettingChange('autoResetTimer', parseInt(e.target.value, 10))}
                                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Unlock PIN</label>
                                <input
                                    type="text"
                                    value={localSettings.kioskPin || ''}
                                    maxLength={6}
                                    onChange={(e) => handleSettingChange('kioskPin', e.target.value.replace(/[^0-9]/g, ''))}
                                    placeholder="Numbers only"
                                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm tracking-widest"
                                />
                            </div>
                        </div>
                    )}
                </div>
                <p className="text-xs text-gray-500 mt-3">When enabled, inactivity locks layout & settings. Unlock requires PIN.</p>
            </div>
        </div>
    );

return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" aria-modal="true">
        <div className="relative transform overflow-hidden rounded-lg bg-gray-800 border border-gray-700 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl p-0 h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-700 flex items-center justify-between bg-gray-800">
                <h2 className="text-xl font-bold text-white">Settings</h2>
                <div className="flex gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all">Save Changes</button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-700 bg-gray-800">
                <button onClick={() => setActiveTab('general')} className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>General</button>
                <button onClick={() => setActiveTab('layouts')} className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'layouts' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Layouts</button>
                <button onClick={() => setActiveTab('pro')} className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pro' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Pro Features</button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-900">
                {activeTab === 'general' && (
                    <div className="space-y-8">
                        {/* Frame Management Section */}
                        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                            <h3 className="text-lg font-medium text-white mb-4">Frame Management</h3>

                            {/* Layout Selector for Editing */}
                            {localSettings.frameSrc && (
                                <div className="mb-4 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Editing Layout For:</label>
                                    <select
                                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                        onChange={(e) => handleLayoutSelectForEditing(e.target.value)}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Select a layout to edit...</option>
                                        {(localSettings.availableFrames?.find(f => f.thumbnailSrc === localSettings.frameSrc)?.supportedLayouts || []).map(sl => {
                                            const layoutOption = localSettings.layoutOptions.find(lo => lo.id === sl.layoutId);
                                            return (
                                                <option key={sl.layoutId} value={sl.layoutId}>
                                                    {layoutOption?.label || sl.layoutId}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <p className="text-xs text-gray-400 mt-2">Select a layout to load its placeholders into the editor. Save changes in the "Layouts" tab.</p>
                                </div>
                            )}

                            <FrameUploader
                                onFrameSelect={handleFrameFileChange}
                                organizerSettings={localSettings}
                                onSettingsChange={(s) => setLocalSettings(prev => ({ ...prev, ...s }))}
                                setDirectoryHandle={() => { }}
                                gapiAuthInstance={null}
                                isGapiReady={false}
                                isSignedIn={false}
                                pickerApiLoaded={false}
                                availableLayouts={localSettings.layoutOptions || []}
                            />

                            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {/* Frame List */}
                                {(localSettings.availableFrames || []).map((frame, index) => (
                                    <div key={index} className="relative group aspect-[2/3] bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                                        <img src={frame.thumbnailSrc} alt={`Frame ${index + 1}`} className="w-full h-full object-contain" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleSetDefaultFrame(frame)}
                                                className={`px-3 py-1 rounded text-xs font-bold ${localSettings.frameSrc === frame.thumbnailSrc ? 'bg-green-600 text-white' : 'bg-white text-black hover:bg-gray-200'}`}
                                            >
                                                {localSettings.frameSrc === frame.thumbnailSrc ? 'Default' : 'Set Default'}
                                            </button>
                                            <button
                                                onClick={() => handleRemoveFrame(index)}
                                                className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                        {localSettings.frameSrc === frame.thumbnailSrc && (
                                            <div className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full border border-white shadow-sm"></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        {renderGeneralSettings()}
                    </div>
                )}
                {activeTab === 'layouts' && renderLayoutSettings()}
                {activeTab === 'pro' && renderProSettings()}
                {isEditingLayout && (
                    <LayoutEditorModal
                        layout={localSettings.layoutOptions?.find(l => l.id === editingLayoutId)}
                        onClose={() => {
                            setIsEditingLayout(false);
                            setEditingLayoutId(null);
                        }}
                        onSave={handleSaveLayoutPlaceholders}
                    />
                )}
            </div>
        </div>
    </div>
);
};

export default SettingsPanel;
