// Fix: Import `useEffect` from `react`.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UploadIcon, ZoomInIcon, ZoomOutIcon, ResetIcon, SettingsIcon, GoogleDriveIcon } from './icons';
import { OrganizerSettings } from '../types';

declare const google: any;

// Add type definition for window.showDirectoryPicker to fix TypeScript error.
declare global {
  interface Window {
    showDirectoryPicker(options?: {
      mode?: 'read' | 'readwrite';
    }): Promise<FileSystemDirectoryHandle>;
  }
}



const SetupModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  settings: OrganizerSettings;
  onSave: (settings: OrganizerSettings) => void;
  setDirectoryHandle: React.Dispatch<React.SetStateAction<FileSystemDirectoryHandle | null>>;
  gapiAuthInstance: any;
  isGapiReady: boolean;
  isSignedIn: boolean;
  pickerApiLoaded: boolean;
}> = ({ isOpen, onClose, settings, onSave, setDirectoryHandle, gapiAuthInstance, isGapiReady, isSignedIn, pickerApiLoaded }) => {
  const [localSettings, setLocalSettings] = useState<OrganizerSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleSettingChange = (field: keyof OrganizerSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSignIn = () => gapiAuthInstance?.signIn();
  const handleSignOut = () => gapiAuthInstance?.signOut();

  const handleSelectDriveFolder = () => {
    const accessToken = gapiAuthInstance.currentUser.get().getAuthResponse().access_token;
    if (pickerApiLoaded && accessToken) {
      const view = new google.picker.View(google.picker.ViewId.FOLDERS);
      view.setMimeTypes("application/vnd.google-apps.folder");
      const picker = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .setAppId(gapiAuthInstance.clientId)
        .setOAuthToken(accessToken)
        .addView(view)
        .setCallback((data: any) => {
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0];
            setLocalSettings(prev => ({ ...prev, driveFolderId: doc.id, driveFolderName: doc.name }));
          }
        })
        .build();
      picker.setVisible(true);
    }
  };


  const handleSelectFolder = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        alert('Your browser does not support local folder access. Please use a modern browser like Chrome or Edge.');
        return;
      }
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });
      setDirectoryHandle(handle);
      handleSettingChange('localDownloadPath', handle.name);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error selecting directory:', err);
      }
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" aria-modal="true">
      <div className="relative transform overflow-hidden rounded-lg bg-[var(--color-panel)] border border-[var(--color-border)] text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg p-6 space-y-4">
        <h3 className="text-lg font-medium leading-6 text-[var(--color-text-primary)]">Organizer Settings</h3>
        <p className="text-sm text-[var(--color-text-primary)] opacity-70">Configure these settings before the event. They will persist for the session.</p>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] opacity-80">Google Drive Integration</label>
          <div className="mt-1 p-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-md space-y-2">
            {!isGapiReady ? (
              <p className="text-xs text-center text-gray-400">Loading Google Services...</p>
            ) : !isSignedIn ? (
              <button onClick={handleSignIn} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                <GoogleDriveIcon className="w-5 h-5" /> Connect to Google Drive
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-300">Connected as: <span className="font-bold">{gapiAuthInstance?.currentUser.get().getBasicProfile().getEmail()}</span></p>
                  <button onClick={handleSignOut} className="text-xs text-red-400 hover:underline">Disconnect</button>
                </div>
                <div className="flex items-center gap-2">
                  <input type="text" readOnly value={localSettings.driveFolderName || "No folder selected"} className="block w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-md p-2 text-sm text-[var(--color-text-primary)] opacity-70" />
                  <button onClick={handleSelectDriveFolder} className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-md filter hover:brightness-110 flex-shrink-0">Select Folder...</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] opacity-80">Local Download Folder (for Auto-Saving)</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="text" readOnly value={localSettings.localDownloadPath || "No folder selected"} className="block w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-md p-2 text-sm text-[var(--color-text-primary)] opacity-70" />
            <button onClick={handleSelectFolder} className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-md filter hover:brightness-110 flex-shrink-0">Select...</button>
          </div>
        </div>

        <div>
          <label htmlFor="fileNameTemplate" className="block text-sm font-medium text-[var(--color-text-primary)] opacity-80">File Name Template</label>
          <input type="text" id="fileNameTemplate" value={localSettings.fileNameTemplate} onChange={(e) => handleSettingChange('fileNameTemplate', e.target.value)} className="mt-1 block w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-md p-2 text-sm text-[var(--color-text-primary)] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]" />
          <p className="text-xs text-gray-500 mt-1">Use placeholders: <code className="bg-black/20 px-1 rounded">{`{date}`}</code> <code className="bg-black/20 px-1 rounded">{`{time}`}</code> <code className="bg-black/20 px-1 rounded">{`{timestamp}`}</code> <code className="bg-black/20 px-1 rounded">{`{number}`}</code></p>
        </div>

        <div>
          <label htmlFor="autoReset" className="block text-sm font-medium text-[var(--color-text-primary)] opacity-80">Auto-Reset Timer (Seconds)</label>
          <input type="number" id="autoReset" min="0" value={localSettings.autoResetTimer} onChange={(e) => handleSettingChange('autoResetTimer', parseInt(e.target.value, 10) || 0)} className="mt-1 block w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-md p-2 text-sm text-[var(--color-text-primary)] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]" />
          <p className="text-xs text-gray-500 mt-1">After a photo is finished, the app will reset to the 'Add Photos' screen after this many seconds of inactivity. Set to 0 to disable.</p>
        </div>

        <div className="flex items-center">
          <input type="checkbox" id="kioskMode" checked={localSettings.kioskMode} onChange={(e) => handleSettingChange('kioskMode', e.target.checked)} className="h-4 w-4 rounded border-gray-300 bg-gray-700 text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
          <label htmlFor="kioskMode" className="ml-2 block text-sm text-[var(--color-text-primary)] opacity-80">Enable Kiosk Mode</label>
        </div>
        <p className="text-xs text-gray-500 -mt-3 ml-6">Hides the "Start New Session" button to prevent guests from changing the frame.</p>

        <div className="mt-5 sm:mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="inline-flex justify-center rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] opacity-80 hover:bg-black/20">Cancel</button>
          <button type="button" onClick={handleSave} className="inline-flex justify-center rounded-md border border-transparent bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white filter hover:brightness-110">Save Settings</button>
        </div>
      </div>
    </div>
  );
}


// ... imports

interface LayoutOption {
  id: string;
  label: string;
  type: 'preset' | 'custom';
  isActive: boolean;
}

const LayoutSelectionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedLayoutIds: string[]) => void;
  availableLayouts: LayoutOption[];
}> = ({ isOpen, onClose, onConfirm, availableLayouts }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Start with empty selection - user must explicitly choose
      setSelectedIds([]);
    }
  }, [isOpen, availableLayouts]);

  const toggleLayout = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  if (!isOpen) return null;

  const selectAll = () => {
    setSelectedIds(availableLayouts.filter(l => l.isActive).map(l => l.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" aria-modal="true">
      <div className="relative transform overflow-hidden rounded-lg bg-[var(--color-panel)] border border-[var(--color-border)] text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg p-6 space-y-4">
        <h3 className="text-lg font-medium leading-6 text-[var(--color-text-primary)]">Select Supported Layouts</h3>
        <p className="text-sm text-[var(--color-text-primary)] opacity-70">Choose which layouts this frame supports. ({selectedIds.length} selected)</p>

        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={selectAll}
            className="px-3 py-1 text-xs rounded bg-[var(--color-primary)]/20 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/30 transition-colors"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="px-3 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Clear All
          </button>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-2">
          {availableLayouts.map(layout => (
            <div 
              key={layout.id} 
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border-2 ${
                selectedIds.includes(layout.id) 
                  ? 'bg-[var(--color-primary)]/20 border-[var(--color-primary)]' 
                  : 'border-transparent hover:bg-white/5'
              }`}
              onClick={() => toggleLayout(layout.id)}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(layout.id)}
                onChange={() => toggleLayout(layout.id)}
                className="h-5 w-5 rounded border-gray-300 bg-gray-700 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
              />
              <span className={`text-sm font-medium ${
                selectedIds.includes(layout.id) 
                  ? 'text-[var(--color-primary)]' 
                  : 'text-[var(--color-text-primary)]'
              }`}>
                {layout.label}
              </span>
              {selectedIds.includes(layout.id) && (
                <span className="ml-auto text-[var(--color-primary)] text-xs">✓</span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 sm:mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="inline-flex justify-center rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] opacity-80 hover:bg-black/20 transition-all">Cancel</button>
          <button 
            type="button" 
            onClick={() => onConfirm(selectedIds)} 
            disabled={selectedIds.length === 0}
            className={`inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white transition-all ${
              selectedIds.length === 0
                ? 'bg-gray-600 cursor-not-allowed opacity-50'
                : 'bg-[var(--color-primary)] hover:brightness-110'
            }`}
          >
            Confirm ({selectedIds.length})
          </button>
        </div>
      </div>
    </div>
  );
};

interface FrameUploaderProps {
  onFrameSelect: (frameFile: File, selectedLayoutIds: string[]) => void;
  organizerSettings: OrganizerSettings;
  onSettingsChange: (settings: OrganizerSettings) => void;
  setDirectoryHandle: React.Dispatch<React.SetStateAction<FileSystemDirectoryHandle | null>>;
  gapiAuthInstance: any;
  isGapiReady: boolean;
  isSignedIn: boolean;
  pickerApiLoaded: boolean;
  availableLayouts: LayoutOption[]; // New prop
}

// ... SetupModal ...

const FrameUploader: React.FC<FrameUploaderProps> = ({ onFrameSelect, organizerSettings, onSettingsChange, setDirectoryHandle, availableLayouts, ...gapiProps }) => {
  const [framePreview, setFramePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 });
  const [isSetupModalOpen, setSetupModalOpen] = useState(false);
  const [isLayoutModalOpen, setLayoutModalOpen] = useState(false); // New state
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPanning = useRef(false);
  const lastMousePosition = useRef({ x: 0, y: 0 });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'image/png') {
        setError('Please upload a PNG file.');
        return;
      }
      setSelectedFile(file);
      setFramePreview(URL.createObjectURL(file));
      setError(null);
      setZoom({ scale: 1, x: 0, y: 0 });
    }
  };

  const triggerFileSelect = () => fileInputRef.current?.click();

  const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (zoom.scale > 1) {
      isPanning.current = true;
      lastMousePosition.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (isPanning.current && zoom.scale > 1) {
      const deltaX = e.clientX - lastMousePosition.current.x;
      const deltaY = e.clientY - lastMousePosition.current.y;
      setZoom(prev => ({ ...prev, x: prev.x + deltaX, y: prev.y + deltaY }));
      lastMousePosition.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUpOrLeave = (e: React.MouseEvent<HTMLImageElement>) => {
    isPanning.current = false;
    e.currentTarget.style.cursor = zoom.scale > 1 ? 'grab' : 'pointer';
  };

  const handleConfirmClick = () => {
    if (selectedFile) {
      setLayoutModalOpen(true);
    } else {
      setError('Please select a frame image first.');
    }
  };

  const handleLayoutConfirm = (selectedLayoutIds: string[]) => {
    if (selectedFile) {
      const fileToUpload = selectedFile;
      setLayoutModalOpen(false);

      setFramePreview(null);
      setSelectedFile(null);
      setZoom({ scale: 1, x: 0, y: 0 });

      setTimeout(() => {
        onFrameSelect(fileToUpload, selectedLayoutIds);
      }, 100);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6 p-8 bg-[var(--color-panel)] rounded-2xl shadow-lg relative">
      <SetupModal isOpen={isSetupModalOpen} onClose={() => setSetupModalOpen(false)} settings={organizerSettings} onSave={onSettingsChange} setDirectoryHandle={setDirectoryHandle} {...gapiProps} />
      <LayoutSelectionModal isOpen={isLayoutModalOpen} onClose={() => setLayoutModalOpen(false)} onConfirm={handleLayoutConfirm} availableLayouts={availableLayouts} />

      <button onClick={() => setSetupModalOpen(true)} className="absolute top-4 right-4 text-[var(--color-text-primary)] opacity-70 hover:opacity-100 transition-colors" title="Organizer Settings">
        <SettingsIcon className="w-6 h-6" />
      </button>

      <h2 className="text-2xl font-bold text-[var(--color-primary)]">Step 1: Upload Your Frame</h2>
      <p className="opacity-70 text-center">Upload a transparent PNG to use as an overlay for your photos.</p>

      <div className="flex bg-[var(--color-background)] rounded-lg p-1 border border-[var(--color-border)]">
        <button
          onClick={() => setOrientation('landscape')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${orientation === 'landscape' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-[var(--color-text-primary)] hover:bg-white/5'}`}
        >
          Landscape
        </button>
        <button
          onClick={() => setOrientation('portrait')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${orientation === 'portrait' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-[var(--color-text-primary)] hover:bg-white/5'}`}
        >
          Portrait
        </button>
      </div>

      <div className={`relative border-2 border-dashed border-[var(--color-border)] rounded-xl flex items-center justify-center overflow-hidden transition-all duration-500 ${orientation === 'landscape' ? 'w-[600px] h-[400px]' : 'w-[400px] h-[600px]'} ${!framePreview ? 'hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 cursor-pointer' : 'bg-[var(--color-background)]'}`}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png"
          className="hidden"
        />

        {framePreview ? (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <img
              src={framePreview}
              alt="Frame Preview"
              className="max-w-full max-h-full object-contain transition-transform duration-100 ease-out select-none"
              style={{ transform: `scale(${zoom.scale}) translate(${zoom.x}px, ${zoom.y}px)` }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              draggable={false}
            />
            {/* Zoom Controls Overlay */}
            <div className="absolute bottom-4 right-4 flex gap-2 bg-black/50 backdrop-blur-sm p-2 rounded-lg border border-white/10">
              <button onClick={() => setZoom(z => ({ ...z, scale: Math.max(1, z.scale - 0.1) }))} className="p-1 hover:bg-white/20 rounded text-white"><ZoomOutIcon className="w-5 h-5" /></button>
              <button onClick={() => setZoom({ scale: 1, x: 0, y: 0 })} className="p-1 hover:bg-white/20 rounded text-white"><ResetIcon className="w-5 h-5" /></button>
              <button onClick={() => setZoom(z => ({ ...z, scale: Math.min(3, z.scale + 0.1) }))} className="p-1 hover:bg-white/20 rounded text-white"><ZoomInIcon className="w-5 h-5" /></button>
            </div>
            <button onClick={() => { setFramePreview(null); setSelectedFile(null); }} className="absolute top-4 right-4 p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full shadow-lg transition-transform hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
        ) : (
          <div onClick={triggerFileSelect} className="text-center text-[var(--color-text-primary)] opacity-50 hover:opacity-100 transition-opacity">
            <UploadIcon className="mx-auto h-12 w-12 mb-2" />
            <p className="font-medium">Click to browse</p>
            <p className="text-xs mt-1">Supports PNG</p>
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-sm font-medium animate-pulse">{error}</p>}

      <button
        onClick={handleConfirmClick} // Changed handler
        disabled={!framePreview}
        className="w-full max-w-xs mt-4 px-6 py-3 bg-[var(--color-primary)] text-white font-semibold rounded-lg shadow-md filter hover:brightness-110 disabled:bg-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-opacity-75 transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
      >
        Confirm Frame & Continue
      </button>
    </div>
  );
};

export default FrameUploader;