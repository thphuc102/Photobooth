import React from 'react';
import { Placeholder, Photo } from '../types';

interface GuestLivePreviewProps {
  frameSrc: string | null;
  placeholders: Placeholder[];
  photos: Photo[];
  aspectRatio: string;
  layoutLabel?: string;
  onClick?: () => void;
}

// Simple scaled preview of guest composition (no stickers/text for now)
const GuestLivePreview: React.FC<GuestLivePreviewProps> = ({ frameSrc, placeholders, photos, aspectRatio, layoutLabel, onClick }) => {
  const scale = 0.25; // preview scale relative to a 2/3 canvas assumption
  const ratioParts = aspectRatio.split('/').map(p => parseFloat(p));
  const ratio = ratioParts.length === 2 && ratioParts[1] !== 0 ? ratioParts[0] / ratioParts[1] : (2/3);
  const baseHeight = 480; // reference height
  const height = baseHeight * scale;
  const width = height * ratio;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      <div className="text-xs px-2 py-1 rounded bg-[var(--color-panel)]/80 backdrop-blur border border-[var(--color-border)] text-[var(--color-primary)] font-semibold">Guest Preview{layoutLabel ? ` • ${layoutLabel}` : ''}</div>
      <div
        className="relative rounded-lg overflow-hidden border border-[var(--color-border)] bg-black/50 cursor-pointer shadow-lg"
        style={{ width, height }}
        onClick={onClick}
        title="Guest live preview"
      >
        {frameSrc && <img src={frameSrc} alt="frame" className="absolute inset-0 w-full h-full object-cover opacity-60" />}
        {/* Placeholders */}
        {placeholders.map((p, idx) => {
          const photo = photos[idx];
          return (
            <div
              key={p.id}
              className="absolute border border-white/40 rounded-sm overflow-hidden bg-gray-800/40"
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                width: `${p.width * 100}%`,
                height: `${p.height * 100}%`
              }}
            >
              {photo && <img src={photo.src} alt="slot" className="w-full h-full object-cover" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GuestLivePreview;
