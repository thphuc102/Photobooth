import React from 'react';
import { LayoutOption } from '../types';

interface GuestLayoutStatusProps {
  guestLayoutId: string | null;
  layouts: LayoutOption[];
  photosCount: number;
  frameSrc: string | null;
  placeholders: number;
  onOpenSettings: () => void;
}

const GuestLayoutStatus: React.FC<GuestLayoutStatusProps> = ({ guestLayoutId, layouts, photosCount, frameSrc, placeholders, onOpenSettings }) => {
  const layout = guestLayoutId ? layouts.find(l => l.id === guestLayoutId) : null;
  const filled = photosCount;
  const total = placeholders;
  const ready = total > 0 && filled >= total;

  return (
    <div className="fixed top-4 right-4 z-40 w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/90 backdrop-blur p-4 shadow-lg text-sm">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-[var(--color-primary)]">Guest Session</span>
        <button onClick={onOpenSettings} className="text-xs px-2 py-1 rounded bg-[var(--color-primary)] text-white hover:brightness-110">Settings</button>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between"><span className="opacity-70">Layout:</span><span>{layout ? layout.label : '—'}</span></div>
        <div className="flex justify-between"><span className="opacity-70">Slots:</span><span>{total}</span></div>
        <div className="flex justify-between"><span className="opacity-70">Photos:</span><span>{filled}</span></div>
        <div className="flex justify-between"><span className="opacity-70">Frame:</span><span>{frameSrc ? 'Loaded' : 'None'}</span></div>
        <div className="flex justify-between"><span className="opacity-70">Status:</span><span className={ready ? 'text-green-400' : 'text-yellow-400'}>{ready ? 'Ready' : 'Waiting'}</span></div>
      </div>
      {layout && layout.versions && layout.versions.length > 1 && (
        <p className="mt-2 text-xs opacity-60">Versions: {layout.versions.length}</p>
      )}
    </div>
  );
};

export default GuestLayoutStatus;
