import React from 'react';
import { Printer } from '../types';

export interface PrintJob {
  id: string;
  printerId: string | null;
  createdAt: number;
  status: 'pending' | 'printing' | 'done' | 'paused' | 'error';
  filename: string;
}

interface PrinterQueuePanelProps {
  printers: Printer[];
  jobs: PrintJob[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
  onClose: () => void;
}

const statusColor: Record<PrintJob['status'], string> = {
  pending: 'text-yellow-400',
  printing: 'text-blue-400',
  done: 'text-green-500',
  paused: 'text-orange-400',
  error: 'text-red-500'
};

const PrinterQueuePanel: React.FC<PrinterQueuePanelProps> = ({ printers, jobs, onPause, onResume, onRemove, onClearCompleted, onClose }) => {
  return (
    <div className="fixed bottom-4 left-4 z-40 w-80 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/95 backdrop-blur shadow-lg text-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 className="font-semibold text-[var(--color-primary)]">Printer Queue</h3>
        <button onClick={onClose} className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600">Close</button>
      </div>
      <div className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-gray-700">
        {jobs.length === 0 && <p className="p-4 text-xs text-gray-400">No jobs queued.</p>}
        {jobs.map(job => {
          const printer = printers.find(p => p.id === job.printerId);
          return (
            <div key={job.id} className="px-4 py-3 flex flex-col gap-1 bg-gray-800/40">
              <div className="flex justify-between items-center">
                <span className="font-medium truncate" title={job.filename}>{job.filename}</span>
                <span className={`text-xs font-bold ${statusColor[job.status]}`}>{job.status.toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span>{printer ? printer.name : 'Default'}</span>
                <span>{new Date(job.createdAt).toLocaleTimeString()}</span>
              </div>
              <div className="flex gap-2 mt-1">
                {job.status === 'pending' && (
                  <button onClick={() => onPause(job.id)} className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-xs py-1">Pause</button>
                )}
                {job.status === 'paused' && (
                  <button onClick={() => onResume(job.id)} className="flex-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs py-1">Resume</button>
                )}
                {(job.status === 'pending' || job.status === 'paused') && (
                  <button onClick={() => onRemove(job.id)} className="px-2 bg-red-600 hover:bg-red-500 text-white rounded text-xs py-1">Remove</button>
                )}
                {job.status === 'done' && (
                  <button onClick={() => onRemove(job.id)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs py-1">Dismiss</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-3 border-t border-gray-700 flex gap-2">
        <button
          onClick={onClearCompleted}
          disabled={!jobs.some(j => j.status === 'done')}
          className={`flex-1 text-xs py-2 rounded font-semibold ${jobs.some(j => j.status === 'done') ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
        >Clear Completed</button>
      </div>
    </div>
  );
};

export default PrinterQueuePanel;
