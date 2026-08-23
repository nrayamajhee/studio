import React, { useEffect } from 'react';
import { Sliders, X, Waves, Zap, Radio, Repeat, Sparkles, Volume2, Music } from 'lucide-react';

interface SynthInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SynthInfoModal({ isOpen, onClose }: SynthInfoModalProps) {
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
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl shadow-cyan-950/50 text-slate-200 max-h-[85vh] overflow-y-auto space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Synthesizer Controls & Sound Parameters
              </h3>
              <p className="text-xs text-slate-400">
                Guide to shaping timbre, pitch, envelope dynamics, and acoustic effects
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

        {/* Parameters Guide List */}
        <div className="space-y-4 text-xs">
          
          {/* 1. Waveform & Filter */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-cyan-300 font-semibold uppercase tracking-wider text-[11px]">
              <Waves className="w-4 h-4 text-cyan-400" />
              <span>Oscillator Waveform & Filter Cutoff</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80">
                <span className="font-bold text-white block mb-0.5">Waveform Types:</span>
                <ul className="list-disc list-inside text-slate-400 space-y-0.5 text-[11px]">
                  <li><strong className="text-slate-200">Sine:</strong> Pure, smooth fundamental (flutes, rhodes)</li>
                  <li><strong className="text-slate-200">Triangle:</strong> Warm acoustic tone with soft harmonics</li>
                  <li><strong className="text-slate-200">Sawtooth:</strong> Bright, rich harmonics (strings, brass)</li>
                  <li><strong className="text-slate-200">Square:</strong> Hollow, reedy vintage tone (organs, 8-bit)</li>
                </ul>
              </div>
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80">
                <span className="font-bold text-white block mb-0.5">Filter Cutoff (Hz):</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Low-pass filter that removes high overtones above the chosen frequency. Higher values sound crisp and bright; lower values sound mellow, dark, and warm.
                </p>
              </div>
            </div>
          </div>

          {/* 2. Pitch & Octave Controls */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-amber-300 font-semibold uppercase tracking-wider text-[11px]">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Pitch Tuning & Octave Shifting</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-300 text-[11px]">
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80">
                <strong className="text-white block mb-0.5">Octave Shift:</strong>
                <p className="text-slate-400">
                  Transposes the active keyboard range up or down by full octaves (12 semitones) from Octave 1 to 6.
                </p>
              </div>
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80">
                <strong className="text-white block mb-0.5">Pitch Transpose (st):</strong>
                <p className="text-slate-400">
                  Shifts global pitch in exact semitones (-12 to +12) to easily change musical keys without changing finger positions.
                </p>
              </div>
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80">
                <strong className="text-white block mb-0.5">Fine Tuning (cents):</strong>
                <p className="text-slate-400">
                  Micro-tuning pitch in cents (100 cents = 1 semitone) to tune with acoustic instruments or create chorusing.
                </p>
              </div>
            </div>
          </div>

          {/* 3. ADSR Envelope Dynamics */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-blue-300 font-semibold uppercase tracking-wider text-[11px]">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>ADSR Envelope & Dynamics</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 text-[11px]">
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80">
                <strong className="text-white block mb-0.5">Attack Time (ms):</strong>
                <p className="text-slate-400">
                  How quickly the sound swells to full volume. Fast attacks (5ms) simulate struck piano/pluck strings; slow attacks (150ms+) simulate pads and woodwind swells.
                </p>
              </div>
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80">
                <strong className="text-white block mb-0.5">Release Time (ms):</strong>
                <p className="text-slate-400">
                  How long the note continues to ring out and fade after releasing the key or pedal.
                </p>
              </div>
            </div>
          </div>

          {/* 4. Reverb & Echo (Delay) Effects */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold uppercase tracking-wider text-[11px]">
              <Radio className="w-4 h-4 text-indigo-400" />
              <span>Reverb & Echo Effects</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 text-[11px]">
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80">
                <strong className="text-white block mb-0.5">Convolution Reverb:</strong>
                <p className="text-slate-400">
                  <strong className="text-slate-300">Mix:</strong> Percentage of acoustic room reflections.<br />
                  <strong className="text-slate-300">Decay:</strong> Length in seconds the sound resonates in the simulated acoustic concert hall or cathedral.
                </p>
              </div>
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80">
                <strong className="text-white block mb-0.5">Echo / Delay:</strong>
                <p className="text-slate-400">
                  <strong className="text-slate-300">Mix:</strong> Volume of delayed repeats.<br />
                  <strong className="text-slate-300">Time:</strong> Spacing in milliseconds between successive echoes for rhythmic bounce.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
          >
            Close Guide
          </button>
        </div>

      </div>
    </div>
  );
}
