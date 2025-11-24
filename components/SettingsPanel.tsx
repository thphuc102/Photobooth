import React, { useState, useEffect, useRef } from 'react';
import { Printer, AppSettings, OrganizerSettings, AnalyticsData, Placeholder } from '../types';
import FrameUploader from './FrameUploader'; // Import FrameUploader
import { GoogleDriveIcon, UploadIcon, FolderIcon, ServerIcon, ChipIcon, SwatchIcon } from './icons';
import LayoutEditorModal from './LayoutEditorModal';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    onSettingsChange: (newSettings: AppSettings) => void;
    analytics?: AnalyticsData;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, settings, onSettingsChange, analytics }) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [activeTab, setActiveTab] = useState<'general' | 'layouts' | 'pro'>('general');
    const frameInputRef = useRef<HTMLInputElement>(null);
    const iccInputRef = useRef<HTMLInputElement>(null);

    // New Printer State
    const [newPrinterName, setNewPrinterName] = useState('');
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [editingLayoutId, setEditingLayoutId] = useState<string | null>(null);

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

    const renderLayoutSettings = () => (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-white">Layout Presets</h3>
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
                                        >
                                            Edit
                                        </button>
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

    const frame = (localSettings.availableFrames || []).find(f => f.src === localSettings.frameSrc);
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

    const updatedLayouts = localSettings.layoutOptions.map(l =>
        l.id === editingLayoutId ? { ...l, placeholders } : l
    );
    handleSettingChange('layoutOptions', updatedLayouts);
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
                <h3 className="text-lg font-medium text-white mb-4">Directories</h3>
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
                </div>
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
                                        {(localSettings.availableFrames?.find(f => f.src === localSettings.frameSrc)?.supportedLayouts || []).map(sl => {
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
                                        <img src={frame.src} alt={`Frame ${index + 1}`} className="w-full h-full object-contain" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleSetDefaultFrame(frame)}
                                                className={`px-3 py-1 rounded text-xs font-bold ${localSettings.frameSrc === frame.src ? 'bg-green-600 text-white' : 'bg-white text-black hover:bg-gray-200'}`}
                                            >
                                                {localSettings.frameSrc === frame.src ? 'Default' : 'Set Default'}
                                            </button>
                                            <button
                                                onClick={() => handleRemoveFrame(index)}
                                                className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                        {localSettings.frameSrc === frame.src && (
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
