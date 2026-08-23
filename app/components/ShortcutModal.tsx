import React, { useEffect } from 'react';
import { Keyboard, X, Sliders, Layers, Sparkles } from 'lucide-react';

interface ShortcutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutModal({ isOpen, onClose }: ShortcutModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl shadow-cyan-950/50 text-slate-200 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Keyboard Controls & Mode Guide
              </h3>
              <p className="text-xs text-slate-400">
                Switch target with Tab to play single notes or 3-note chords
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts Content */}
        <div className="space-y-4">
          
          {/* Target Toggle Switch Info */}
          <div className="bg-gradient-to-r from-cyan-950/40 via-purple-950/40 to-slate-950/40 p-3.5 rounded-xl border border-cyan-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-slate-200">Switch Keyboard Mode (Keys vs Chords):</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono">
              <kbd className="px-2 py-1 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-bold">Tab</kbd>
              <span className="text-slate-400">or UI Switch</span>
            </div>
          </div>

          {/* 1. In Chords Mode */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-purple-900/50">
            <div className="font-semibold text-purple-300 text-xs uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                When in "Chords Mode" (Active on Bottom Keyboard)
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                3-Note Triads
              </span>
            </div>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">Major Triads (C D E F G A B):</span>
                <div className="flex gap-1 font-bold text-cyan-300">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">A</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">S</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">D</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">F</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">G</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">H</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">J</kbd>
                </div>
              </div>
              <div className="flex justify-between items-center bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">Minor Triads (Cm Dm Em Fm Gm Am Bm):</span>
                <div className="flex gap-1 font-bold text-purple-300">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">W</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">E</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">R</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">T</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">Y</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">U</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">I</kbd>
                </div>
              </div>
            </div>
          </div>

          {/* 2. In Keys Mode */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-cyan-900/50">
            <div className="font-semibold text-cyan-300 text-xs uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
                When in "Keys Mode" (Active on Top Piano)
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                Solo Notes
              </span>
            </div>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400">Octave 1 White / Black:</span>
                <div className="flex gap-1 font-bold text-cyan-300">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">A-J</kbd>
                  <span className="text-slate-500">/</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300">W,E,T,Y,U</kbd>
                </div>
              </div>
              <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400">Octave 2 White / Black:</span>
                <div className="flex gap-1 font-bold text-purple-300">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">K-↵</kbd>
                  <span className="text-slate-500">/</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-pink-300">O,P,]</kbd>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Dynamics & Sustain */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div className="font-semibold text-emerald-300 text-xs uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span>Pitch & Sustain Dynamics</span>
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
              <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">Octave Down / Up</span>
                <div className="flex gap-1 font-bold text-amber-300">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">Z</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">X</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">Pitch Transpose</span>
                <div className="flex gap-1 font-bold text-cyan-300">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">↓</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">↑</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">Sustain Pedal</span>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-bold text-emerald-300">Hold Space</kbd>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>

      </div>
    </div>
  );
}
