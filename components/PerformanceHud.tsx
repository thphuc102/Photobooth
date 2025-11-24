import React from 'react';

interface PerformanceHudProps {
  fps: number;
  frameMs: number;
  broadcastIntervalMs?: number;
}

const PerformanceHud: React.FC<PerformanceHudProps> = ({ fps, frameMs, broadcastIntervalMs }) => {
  return (
    <div className="fixed bottom-4 right-[18rem] z-40 rounded-lg bg-black/70 border border-[var(--color-border)] px-3 py-2 text-xs font-mono space-y-1 shadow-lg">
      <div className="flex justify-between"><span className="opacity-60">FPS</span><span className={fps < 30 ? 'text-red-400' : fps < 50 ? 'text-yellow-300' : 'text-green-400'}>{fps > 0 ? fps : '…'}</span></div>
      <div className="flex justify-between"><span className="opacity-60">Frame ms</span><span>{frameMs.toFixed(1)}</span></div>
      {broadcastIntervalMs && (
        <div className="flex justify-between"><span className="opacity-60">Broadcast ms</span><span>{broadcastIntervalMs}</span></div>
      )}
    </div>
  );
};

export default PerformanceHud;
