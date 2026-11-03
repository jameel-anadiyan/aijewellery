import React, { useState } from 'react';
import { StudioJob } from '../types';
import {
  X,
  Search,
  History,
  Calendar,
  Gem,
  Trash2,
  FolderOpen,
  Cloud,
  CheckCircle2,
  Key,
} from 'lucide-react';
import { setCustomSupabaseKey } from '../services/supabase';

interface HistoryModalProps {
  history: StudioJob[];
  onClose: () => void;
  onSelectJob: (job: StudioJob) => void;
  onDeleteJob: (jobId: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  history,
  onClose,
  onSelectJob,
  onDeleteJob,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [anonKey, setAnonKey] = useState(
    () => localStorage.getItem('swa_supabase_anon_key') || ''
  );
  const [keySaved, setKeySaved] = useState(false);

  const filteredHistory = history.filter((job) => {
    const term = searchTerm.toLowerCase();
    const skuMatch = job.sku.toLowerCase().includes(term);
    const summaryMatch = job.original.summary.toLowerCase().includes(term);
    const variationMatch = job.variations.some((v) => v.name.toLowerCase().includes(term));
    return skuMatch || summaryMatch || variationMatch;
  });

  const handleSaveKey = () => {
    setCustomSupabaseKey(anonKey.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-3xl rounded-2xl glass-panel border border-gold-500/30 bg-[#0B0C10] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gold-500/15 border border-gold-500/30 flex items-center justify-center text-gold-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-luxury">
                Past Studio Runs & History
              </h3>
              <p className="text-xs text-zinc-400">
                Saved in IndexedDB & Supabase Cloud
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search bar & Supabase config */}
        <div className="p-4 border-b border-zinc-800/80 space-y-3 bg-zinc-950/60">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search past runs by SKU, design name, or jewellery summary..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-gold-500"
            />
          </div>

          {/* Supabase Anon Key optional connector */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 text-xs">
            <div className="flex items-center space-x-1.5 text-zinc-400 text-[11px] whitespace-nowrap">
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supabase Cloud (eylkbycxhptmmqcpvloz):</span>
            </div>
            <div className="flex items-center space-x-2 w-full">
              <input
                type="password"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="Optional: Paste Supabase Anon Key for cloud sync"
                className="flex-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-[11px] focus:outline-none focus:border-gold-500"
              />
              <button
                type="button"
                onClick={handleSaveKey}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium border border-zinc-700 flex items-center space-x-1 whitespace-nowrap"
              >
                {keySaved ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Key className="w-3 h-3 text-gold-400" />}
                <span>{keySaved ? 'Saved' : 'Save'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* History list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">
              <Gem className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No past runs found</p>
              <p className="text-xs text-zinc-600 mt-1">
                Completed runs are automatically cached in IndexedDB
              </p>
            </div>
          ) : (
            filteredHistory.map((job) => {
              const readyCount = job.variations.filter((v) => v.status === 'done').length;
              const dateStr = new Date(job.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={job.jobId}
                  className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 hover:border-gold-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  {/* Left thumbnail and info */}
                  <div className="flex items-center space-x-3.5">
                    <img
                      src={job.photoUrl}
                      alt="Thumbnail"
                      className="w-14 h-14 object-cover rounded-lg bg-black border border-zinc-800 flex-shrink-0"
                    />
                    <div>
                      <div className="flex items-center space-x-2 mb-0.5">
                        <span className="text-xs font-bold text-white">
                          SKU: {job.sku || 'SWA-Custom'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-300 border border-gold-500/30">
                          {job.diamondCount} Stones
                        </span>
                        <span className="text-[10px] text-zinc-500 capitalize">
                          {job.quality} quality
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-1">
                        {job.original.summary || 'Custom jewellery variation run'}
                      </p>
                      <div className="flex items-center space-x-3 text-[11px] text-zinc-500 mt-1">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{dateStr}</span>
                        </span>
                        <span>•</span>
                        <span>{readyCount} of 10 sketches ready</span>
                      </div>
                    </div>
                  </div>

                  {/* Right actions */}
                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    <button
                      onClick={() => onSelectJob(job)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold gold-gradient-bg text-black hover:opacity-95 shadow-md shadow-gold-500/20"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Restore Run</span>
                    </button>
                    <button
                      onClick={() => onDeleteJob(job.jobId)}
                      className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 border border-zinc-700/60 hover:border-red-500/40 transition-colors"
                      title="Delete from history"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
