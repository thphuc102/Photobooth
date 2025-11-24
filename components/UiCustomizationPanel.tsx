


import React, { useRef } from 'react';
// Fix: Import UiConfig from the correct file, types.ts
import { UiConfig } from '../types';
import { UploadIcon } from './icons';

interface UiCustomizationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: UiConfig;
  onConfigChange: (newConfig: UiConfig) => void;
}

// Fix: Define a specific type for color keys to ensure type safety.
type ColorUiConfigKeys = 'primaryColor' | 'textColor' | 'backgroundColor' | 'panelColor' | 'borderColor';

const UiCustomizationPanel: React.FC<UiCustomizationPanelProps> = ({ isOpen, onClose, config, onConfigChange }) => {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoSrc' | 'backgroundSrc') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onConfigChange({ ...config, [field]: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
    e.target.value = ''; // Reset file input
  };

  const handleRemoveImage = (field: 'logoSrc' | 'backgroundSrc') => {
    onConfigChange({ ...config, [field]: null });
  };
  
  if (!isOpen) return null;

  const fontOptions = [
      { label: 'Roboto', value: "'Roboto', sans-serif" },
      { label: 'Lato', value: "'Lato', sans-serif" },
      { label: 'Montserrat', value: "'Montserrat', sans-serif" },
      { label: 'Open Sans', value: "'Open Sans', sans-serif" },
      { label: 'Poppins', value: "'Poppins', sans-serif" },
  ];

  // Fix: Use the specific ColorUiConfigKeys type to ensure `key` is a string and `config[key]` resolves to a string.
  const colorFields: {label: string, key: ColorUiConfigKeys}[] = [
      { label: 'Accent', key: 'primaryColor' },
      { label: 'Text', key: 'textColor' },
      { label: 'Background', key: 'backgroundColor' },
      { label: 'Panels', key: 'panelColor' },
      { label: 'Borders', key: 'borderColor' },
  ]

  return (
    <div className={`fixed top-0 right-0 h-full w-80 bg-[var(--color-panel)]/95 backdrop-blur-lg border-l border-[var(--color-border)] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="p-4 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-[var(--color-primary)]">Customize UI</h2>
          <button onClick={onClose} className="p-1 rounded-full opacity-70 hover:bg-black/20 hover:opacity-100">&times;</button>
        </div>
        
        <div className="flex-grow overflow-y-auto pr-2 space-y-6">
          {/* Text Fields */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium opacity-80">Title</label>
            <input type="text" id="title" value={config.title} onChange={(e) => onConfigChange({ ...config, title: e.target.value })} className="mt-1 block w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-md p-2 text-sm focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]" />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium opacity-80">Description</label>
            <textarea id="description" value={config.description} onChange={(e) => onConfigChange({ ...config, description: e.target.value })} rows={2} className="mt-1 block w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-md p-2 text-sm focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]" />
          </div>
           <div>
            <label htmlFor="footer" className="block text-sm font-medium opacity-80">Footer Text</label>
            <input type="text" id="footer" value={config.footer} onChange={(e) => onConfigChange({ ...config, footer: e.target.value })} className="mt-1 block w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-md p-2 text-sm focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]" />
          </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <label htmlFor="highContrastMode" className="text-sm opacity-70">High Contrast</label>
                    <input
                      id="highContrastMode"
                      type="checkbox"
                      checked={!!config.highContrastMode}
                      onChange={(e) => onConfigChange({ ...config, highContrastMode: e.target.checked })}
                      aria-checked={!!config.highContrastMode}
                      aria-label="Toggle high contrast mode"
                      className="w-5 h-5 cursor-pointer accent-[var(--color-primary)]"
                    />
                </div>
           <div>
                <label htmlFor="font" className="block text-sm font-medium opacity-80">Font Family</label>
                <select id="font" value={config.fontFamily} onChange={(e) => onConfigChange({ ...config, fontFamily: e.target.value })} className="mt-1 block w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-md p-2 text-sm focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]">
                    {fontOptions.map(font => (
            <button onClick={onClose} className="w-full px-4 py-2 bg-[var(--color-primary)] text-white font-semibold rounded-lg shadow-md filter hover:brightness-110" aria-label="Close panel and apply changes">
                Done
            </button>
            </div>
          
          {/* Logo Uploader */}
          <div>
            <label className="block text-sm font-medium opacity-80 mb-2">Logo</label>
            <input type="file" ref={logoInputRef} onChange={(e) => handleFileChange(e, 'logoSrc')} accept="image/*" className="hidden" />
            <div className="w-full h-24 border-2 border-dashed border-[var(--color-border)] rounded-lg flex items-center justify-center bg-[var(--color-background)]/50">
              {config.logoSrc ? (
                <div className="relative group p-2">
                    <img src={config.logoSrc} alt="Logo Preview" className="max-h-20 max-w-full object-contain" />
                    <button onClick={() => handleRemoveImage('logoSrc')} className="absolute -top-1 -right-1 p-0.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-700">&times;</button>
                </div>
              ) : (
                <button onClick={() => logoInputRef.current?.click()} className="text-center text-gray-500 hover:text-[var(--color-primary)]">
                  <UploadIcon className="mx-auto h-8 w-8" />
                  <p className="text-xs mt-1">Upload Logo</p>
                </button>
              )}
            </div>
          </div>
          
          {/* Background Uploader */}
          <div>
            <label className="block text-sm font-medium opacity-80 mb-2">Background Image</label>
            <input type="file" ref={backgroundInputRef} onChange={(e) => handleFileChange(e, 'backgroundSrc')} accept="image/*" className="hidden" />
            <div className="w-full h-24 border-2 border-dashed border-[var(--color-border)] rounded-lg flex items-center justify-center bg-[var(--color-background)]/50">
              {config.backgroundSrc ? (
                <div className="relative group w-full h-full">
                    <img src={config.backgroundSrc} alt="Background Preview" className="w-full h-full object-cover rounded-md" />
                    <div className="absolute inset-0 bg-black/50"></div>
                    <button onClick={() => handleRemoveImage('backgroundSrc')} className="absolute top-1 right-1 p-0.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-700">&times;</button>
                </div>
              ) : (
                <button onClick={() => backgroundInputRef.current?.click()} className="text-center text-gray-500 hover:text-[var(--color-primary)]">
                  <UploadIcon className="mx-auto h-8 w-8" />
                  <p className="text-xs mt-1">Upload Background</p>
                </button>
              )}
            </div>
          </div>

           {/* Color Pickers */}
          <div>
            <h3 className="text-sm font-medium opacity-80 mb-2">Advanced Colors</h3>
            <div className="space-y-3 p-3 bg-[var(--color-background)]/50 rounded-lg border border-[var(--color-border)]">
                {colorFields.map(({label, key}) => (
                     <div key={key} className="flex items-center justify-between">
                        <label htmlFor={key} className="text-sm opacity-70">{label}</label>
                        <div className="p-0.5 rounded-md border border-white/20" style={{ backgroundColor: config[key] }}>
                           <input type="color" id={key} value={config[key]} onChange={(e) => onConfigChange({ ...config, [key]: e.target.value })} className="w-6 h-6 p-0 border-none rounded-sm cursor-pointer bg-transparent appearance-none" />
                        </div>
                    </div>
                ))}
            </div>
          </div>
        </div>
        
        <div className="flex-shrink-0 pt-4">
            <button onClick={onClose} className="w-full px-4 py-2 bg-[var(--color-primary)] text-white font-semibold rounded-lg shadow-md filter hover:brightness-110">
                Done
            </button>
        </div>
      </div>
    </div>
  );
};

export default UiCustomizationPanel;