import React from 'react';
import {
  type SynthSettings,
  type WaveformType,
  INSTRUMENT_PRESETS,
  type InstrumentPreset,
} from '../audio/synthEngine';
import {
  Volume2,
  VolumeX,
  Sliders,
  RotateCcw,
  Sparkles,
  Waves,
  Zap,
  Disc,
  OctagonX,
  Radio,
  Repeat,
} from 'lucide-react';

interface SynthControlsProps {
  settings: SynthSettings;
  onUpdateSettings: (newSettings: Partial<SynthSettings>) => void;
  onResetPitch: () => void;
  onPanic: () => void;
}

const WAVEFORMS: { type: WaveformType; label: string; icon: string }[] = [
  { type: 'sine', label: 'Sine', icon: '∿' },
  { type: 'triangle', label: 'Triangle', icon: '⋀' },
  { type: 'sawtooth', label: 'Sawtooth', icon: '⩘' },
  { type: 'square', label: 'Square', icon: '⊓' },
];

export function SynthControls({
  settings,
  onUpdateSettings,
  onResetPitch,
  onPanic,
}: SynthControlsProps) {
  const handleSelectPreset = (preset: InstrumentPreset) => {
    onUpdateSettings({
      ...preset.settings,
      activePresetId: preset.id,
    });
  };

  return (
    <div className="w-full max-w-5xl bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 text-slate-200">
      
      {/* 1. Instrument Presets Selector & Top Controls */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Instrument Presets</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Sustain Pedal Hold Button */}
            <button
              type="button"
              onMouseDown={() => onUpdateSettings({ sustainPedal: true })}
              onMouseUp={() => onUpdateSettings({ sustainPedal: false })}
              onMouseLeave={() => {
                if (settings.sustainPedal) onUpdateSettings({ sustainPedal: false });
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                onUpdateSettings({ sustainPedal: true });
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                onUpdateSettings({ sustainPedal: false });
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md select-none cursor-pointer ${
                settings.sustainPedal
                  ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.6)] scale-[0.98]'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <Disc className={`w-3.5 h-3.5 ${settings.sustainPedal ? 'animate-spin' : ''}`} />
              <span>Sustain: {settings.sustainPedal ? 'ACTIVE' : 'Hold [Space]'}</span>
            </button>

            {/* Reset Pitch Button */}
            <button
              type="button"
              onClick={onResetPitch}
              title="Reset Pitch to Default"
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              Reset Pitch
            </button>

            {/* Panic / Force Stop Sound Button */}
            <button
              type="button"
              onClick={onPanic}
              title="Force Stop All Sound [Esc]"
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-rose-100 border border-rose-800/80 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <OctagonX className="w-3.5 h-3.5 text-rose-400" />
              <span>Stop Sound</span>
            </button>
          </div>
        </div>

        {/* Preset Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {INSTRUMENT_PRESETS.map((preset) => {
            const isSelected = settings.activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`p-2.5 rounded-xl flex flex-col items-center justify-center text-center transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_14px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/50'
                    : 'bg-slate-950/70 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <span className="text-xl mb-1">{preset.iconSymbol}</span>
                <span className="text-xs font-semibold leading-tight">{preset.name}</span>
                <span className="text-[9px] font-mono text-slate-400 mt-0.5">{preset.category}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Main Synth Parameters Grid (5 Columns on Desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-2 border-t border-slate-800">
        
        {/* Col 1: Waveform & Filter Cutoff */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2 text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Waves className="w-3.5 h-3.5 text-cyan-400" />
                Waveform
              </span>
              <span className="text-cyan-400 font-bold capitalize text-[11px]">{settings.waveform}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {WAVEFORMS.map((wave) => (
                <button
                  key={wave.type}
                  type="button"
                  onClick={() => onUpdateSettings({ waveform: wave.type, activePresetId: undefined })}
                  className={`p-1.5 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all border cursor-pointer ${
                    settings.waveform === wave.type
                      ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                      : 'bg-slate-900 hover:bg-slate-800/80 text-slate-300 border-slate-800'
                  }`}
                >
                  <span className="text-base leading-none font-bold">{wave.icon}</span>
                  <span className="text-[11px]">{wave.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Filter Cutoff</span>
              <span className="font-mono text-cyan-400 font-semibold">{Math.round(settings.filterCutoff)} Hz</span>
            </div>
            <input
              type="range"
              min="200"
              max="16000"
              step="50"
              value={settings.filterCutoff}
              onChange={(e) => onUpdateSettings({ filterCutoff: Number(e.target.value), activePresetId: undefined })}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Col 2: Octave Shift & Transpose */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2 text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Octave Shift
              </span>
              <span className="font-mono text-amber-400 font-bold text-[11px]">Oct {settings.baseOctave}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={settings.baseOctave <= 1}
                onClick={() => onUpdateSettings({ baseOctave: Math.max(1, settings.baseOctave - 1) })}
                className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white font-mono font-bold transition-colors border border-slate-700 flex flex-col items-center justify-center cursor-pointer"
              >
                <span className="text-xs">-1 Oct</span>
                <span className="text-[9px] text-slate-400 font-normal">[Z]</span>
              </button>
              <div className="px-3 py-1.5 bg-slate-900 border border-slate-700/60 rounded-lg font-mono font-bold text-base text-cyan-300">
                {settings.baseOctave}
              </div>
              <button
                type="button"
                disabled={settings.baseOctave >= 6}
                onClick={() => onUpdateSettings({ baseOctave: Math.min(6, settings.baseOctave + 1) })}
                className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white font-mono font-bold transition-colors border border-slate-700 flex flex-col items-center justify-center cursor-pointer"
              >
                <span className="text-xs">+1 Oct</span>
                <span className="text-[9px] text-slate-400 font-normal">[X]</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>Pitch Transpose</span>
              <span className="font-mono text-cyan-400 font-bold">
                {settings.pitchShiftSemi > 0 ? `+${settings.pitchShiftSemi}` : settings.pitchShiftSemi} st
              </span>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="1"
              value={settings.pitchShiftSemi}
              onChange={(e) => onUpdateSettings({ pitchShiftSemi: Number(e.target.value) })}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-0.5">
              <span>-12</span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ pitchShiftSemi: 0 })}
                className="hover:text-cyan-400 cursor-pointer"
              >
                0 st
              </button>
              <span>+12</span>
            </div>
          </div>
        </div>

        {/* Col 3: Fine Tuning & Pitch Bend Wheel */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2 text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                Fine Tuning
              </span>
              <span className="font-mono text-purple-400 font-bold text-[11px]">
                {settings.fineTuneCents > 0 ? `+${settings.fineTuneCents}` : settings.fineTuneCents} ¢
              </span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={settings.fineTuneCents}
              onChange={(e) => onUpdateSettings({ fineTuneCents: Number(e.target.value) })}
              className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-0.5">
              <span>-100¢</span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ fineTuneCents: 0 })}
                className="hover:text-purple-400 cursor-pointer"
              >
                Center
              </button>
              <span>+100¢</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>Pitch Bend Wheel</span>
              <span className="font-mono text-emerald-400 font-semibold">
                {(settings.pitchBend * 2).toFixed(1)} st
              </span>
            </div>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.05"
              value={settings.pitchBend}
              onChange={(e) => onUpdateSettings({ pitchBend: Number(e.target.value) })}
              onMouseUp={() => onUpdateSettings({ pitchBend: 0 })}
              onTouchEnd={() => onUpdateSettings({ pitchBend: 0 })}
              className="w-full accent-emerald-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
            <p className="text-[9px] text-slate-500 mt-0.5 text-center">
              (Auto-springs to center)
            </p>
          </div>
        </div>

        {/* Col 4: ADSR Envelope & Master Volume */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2 text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                ADSR Envelope
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
              <div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Attack</span>
                  <span className="font-mono text-cyan-400">{(settings.attack * 1000).toFixed(0)}ms</span>
                </div>
                <input
                  type="range"
                  min="0.005"
                  max="0.5"
                  step="0.005"
                  value={settings.attack}
                  onChange={(e) => onUpdateSettings({ attack: Number(e.target.value), activePresetId: undefined })}
                  className="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Release</span>
                  <span className="font-mono text-cyan-400">{(settings.release * 1000).toFixed(0)}ms</span>
                </div>
                <input
                  type="range"
                  min="0.02"
                  max="1.5"
                  step="0.02"
                  value={settings.release}
                  onChange={(e) => onUpdateSettings({ release: Number(e.target.value), activePresetId: undefined })}
                  className="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                {settings.volume === 0 ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3 text-cyan-400" />}
                Master Volume
              </span>
              <span className="font-mono text-cyan-400 font-bold">{Math.round(settings.volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.volume}
              onChange={(e) => onUpdateSettings({ volume: Number(e.target.value) })}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Col 5: Reverb & Echo (Delay) Effects */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
          {/* Reverb Controls */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-indigo-400" />
                Reverb
              </span>
              <span className="font-mono text-indigo-300 font-bold text-[11px]">
                {Math.round(settings.reverbLevel * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={settings.reverbLevel}
              onChange={(e) => onUpdateSettings({ reverbLevel: Number(e.target.value), activePresetId: undefined })}
              className="w-full accent-indigo-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Decay</span>
              <span className="font-mono text-indigo-300">{settings.reverbDecay.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.2"
              value={settings.reverbDecay}
              onChange={(e) => onUpdateSettings({ reverbDecay: Number(e.target.value), activePresetId: undefined })}
              className="w-full accent-indigo-400 h-1 bg-slate-800 rounded cursor-pointer"
            />
          </div>

          {/* Echo / Delay Controls */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-1 text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-teal-400" />
                Echo (Delay)
              </span>
              <span className="font-mono text-teal-300 font-bold text-[11px]">
                {Math.round(settings.echoLevel * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={settings.echoLevel}
              onChange={(e) => onUpdateSettings({ echoLevel: Number(e.target.value), activePresetId: undefined })}
              className="w-full accent-teal-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Time</span>
              <span className="font-mono text-teal-300">{Math.round(settings.echoTime * 1000)}ms</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.8"
              step="0.02"
              value={settings.echoTime}
              onChange={(e) => onUpdateSettings({ echoTime: Number(e.target.value), activePresetId: undefined })}
              className="w-full accent-teal-400 h-1 bg-slate-800 rounded cursor-pointer"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
