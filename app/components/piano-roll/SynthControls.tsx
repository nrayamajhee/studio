import React, { useState, useEffect, useRef } from "react";
import { synth, type SynthParams } from "../../lib/synth";
import { Card } from "../design-system/Card";
import { Slider } from "../design-system/Slider";
import { Dropdown } from "../design-system/Dropdown";
import { cn } from "../../lib/utils";

export interface SynthControlsProps {
  className?: string;
  selectedPreset?: string;
  leftHeaderSlot?: React.ReactNode;
  rightHeaderSlot?: React.ReactNode;
}

export const SynthControls: React.FC<SynthControlsProps> = ({
  className,
  selectedPreset = "grand_piano",
  leftHeaderSlot,
  rightHeaderSlot,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [params, setParams] = useState<SynthParams>({ ...synth.params });
  const [prevPreset, setPrevPreset] = useState(selectedPreset);

  if (selectedPreset !== prevPreset) {
    setPrevPreset(selectedPreset);
    setParams({ ...synth.params });
  }

  // Realtime oscilloscope animation
  useEffect(() => {
    let animationFrameId: number;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const analyser = synth.getAnalyser();
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = "#07090e";
      ctx.fillRect(0, 0, width, height);

      // Baseline glowing amber wire
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#251d12";
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (analyser) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#d4a359";
        ctx.shadowColor = "rgba(212, 163, 89, 0.65)";
        ctx.shadowBlur = 8;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleParamChange = <K extends keyof SynthParams>(
    key: K,
    value: SynthParams[K],
  ) => {
    synth.updateParam(key, value);
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full w-full select-none overflow-hidden gap-1.5",
        className,
      )}
    >
      {/* Waveform Canvas Container & Expansion Slots */}
      <div className="flex items-stretch gap-2 flex-shrink-0 w-full">
        {leftHeaderSlot}
        <Card
          elevation="low"
          className="flex-1 bg-[#0b0e14] border border-[#1f2533] rounded-xl p-1.5 flex flex-col justify-center flex-shrink-0 shadow-inner min-w-0"
        >
          <canvas
            ref={canvasRef}
            width={640}
            height={48}
            className="w-full h-11 rounded-lg bg-[#05070a] border border-[#171c26]"
          />
        </Card>
        {rightHeaderSlot}
      </div>

      {/* 6 Module Cards Side-by-Side */}
      <div className="flex-1 min-h-0 flex items-stretch gap-2.5 overflow-x-auto pb-1">
        {/* 1. Exciter / Click */}
        <Card
          elevation="low"
          className="bg-[#0e121a] border border-[#1f2533] rounded-xl p-2.5 flex flex-col justify-between min-w-[170px] max-w-[210px] flex-1 shadow-sm"
        >
          <span className="text-[11px] font-bold tracking-wider text-[#d4a359] uppercase mb-1 block">
            1. Exciter / Click
          </span>

          <div className="space-y-1.5 flex-1 flex flex-col justify-between">
            <Dropdown
              tone="accent"
              label="Exciter Mode"
              value={params.exciterMode}
              onChange={(val) => handleParamChange("exciterMode", val as never)}
              options={[
                { value: "thud", label: "Felt Thud (Piano)" },
                { value: "noise", label: "Noise Transient (Pluck)" },
                { value: "click", label: "High Click (Slap)" },
                { value: "drum", label: "Acoustic Drum (Kick)" },
                { value: "off", label: "Disabled" },
              ]}
            />

            <Slider
              tone="accent"
              label="Exciter Amount"
              valueDisplay={`${Math.round(params.exciterVol * 100)}%`}
              min={0}
              max={1}
              step={0.01}
              value={params.exciterVol}
              onChange={(val) => handleParamChange("exciterVol", val)}
            />

            <Slider
              tone="accent"
              label="Impulse Tone"
              valueDisplay={`${Math.round(params.exciterFreq)} Hz`}
              min={30}
              max={4000}
              step={10}
              value={params.exciterFreq}
              onChange={(val) => handleParamChange("exciterFreq", val)}
            />

            <Slider
              tone="accent"
              label="Impulse Decay"
              valueDisplay={`${params.exciterDecay.toFixed(3)} s`}
              min={0.005}
              max={0.2}
              step={0.001}
              value={params.exciterDecay}
              onChange={(val) => handleParamChange("exciterDecay", val)}
            />
          </div>
        </Card>

        {/* 2. Tone Core */}
        <Card
          elevation="low"
          className="bg-[#0e121a] border border-[#1f2533] rounded-xl p-2.5 flex flex-col justify-between min-w-[170px] max-w-[210px] flex-1 shadow-sm"
        >
          <span className="text-[11px] font-bold tracking-wider text-[#d4a359] uppercase mb-1 block">
            2. Tone Core
          </span>

          <div className="space-y-1.5 flex-1 flex flex-col justify-between">
            <Dropdown
              tone="accent"
              label="Osc 1 Waveform"
              value={params.osc1Wave}
              onChange={(val) =>
                handleParamChange("osc1Wave", val as OscillatorType)
              }
              options={[
                { value: "triangle", label: "Triangle (Grand)" },
                { value: "sawtooth", label: "Sawtooth (Bright)" },
                { value: "square", label: "Square (Hollow)" },
                { value: "sine", label: "Sine (Sub)" },
              ]}
            />

            <Dropdown
              tone="accent"
              label="Osc 2 Waveform"
              value={params.osc2Wave}
              onChange={(val) =>
                handleParamChange("osc2Wave", val as OscillatorType | "off")
              }
              options={[
                { value: "triangle", label: "Triangle (Layer)" },
                { value: "sawtooth", label: "Sawtooth (Detune)" },
                { value: "sine", label: "Sine (Sub Octave)" },
                { value: "square", label: "Square (Lead)" },
                { value: "off", label: "Disabled" },
              ]}
            />

            <Slider
              tone="accent"
              label="Osc 2 Detune"
              valueDisplay={`${params.detune.toFixed(1)} cents`}
              min={0}
              max={25}
              step={0.1}
              value={params.detune}
              onChange={(val) => handleParamChange("detune", val)}
            />

            <Dropdown
              tone="accent"
              label="Osc 2 Octave"
              value={params.osc2Oct}
              onChange={(val) =>
                handleParamChange("osc2Oct", parseInt(val, 10))
              }
              options={[
                { value: -12, label: "-12 (Sub)" },
                { value: 0, label: "0 (Unison)" },
                { value: 12, label: "+12 (+1 Oct)" },
              ]}
            />
          </div>
        </Card>

        {/* 3. Filter Matrix */}
        <Card
          elevation="low"
          className="bg-[#0e121a] border border-[#1f2533] rounded-xl p-2.5 flex flex-col justify-between min-w-[170px] max-w-[210px] flex-1 shadow-sm"
        >
          <span className="text-[11px] font-bold tracking-wider text-[#d4a359] uppercase mb-1 block">
            3. Filter Matrix
          </span>

          <div className="space-y-1.5 flex-1 flex flex-col justify-between">
            <Dropdown
              tone="accent"
              label="Filter Mode"
              value={params.filterType}
              onChange={(val) =>
                handleParamChange("filterType", val as BiquadFilterType)
              }
              options={[
                { value: "lowpass", label: "Lowpass (24dB)" },
                { value: "bandpass", label: "Bandpass (12dB)" },
                { value: "highpass", label: "Highpass (12dB)" },
                { value: "notch", label: "Notch Filter" },
              ]}
            />

            <Slider
              tone="accent"
              label="Base Cutoff"
              valueDisplay={`${Math.round(params.cutoff)} Hz`}
              min={80}
              max={12000}
              step={20}
              value={params.cutoff}
              onChange={(val) => handleParamChange("cutoff", val)}
            />

            <Slider
              tone="accent"
              label="Env Sweep Peak"
              valueDisplay={`${Math.round(params.envMod)} Hz`}
              min={0}
              max={7000}
              step={50}
              value={params.envMod}
              onChange={(val) => handleParamChange("envMod", val)}
            />

            <Slider
              tone="accent"
              label="Keytracking"
              valueDisplay={`${Math.round(params.keytrack * 100)}%`}
              min={-1}
              max={1}
              step={0.02}
              value={params.keytrack}
              onChange={(val) => handleParamChange("keytrack", val)}
            />
          </div>
        </Card>

        {/* 4. LFO & Mod */}
        <Card
          elevation="low"
          className="bg-[#0e121a] border border-[#1f2533] rounded-xl p-2.5 flex flex-col justify-between min-w-[170px] max-w-[210px] flex-1 shadow-sm"
        >
          <span className="text-[11px] font-bold tracking-wider text-[#d4a359] uppercase mb-1 block">
            4. LFO & Mod
          </span>

          <div className="space-y-1.5 flex-1 flex flex-col justify-between">
            <Dropdown
              tone="accent"
              label="LFO Destination"
              value={params.lfoDest}
              onChange={(val) => handleParamChange("lfoDest", val as never)}
              options={[
                { value: "pitch", label: "Pitch (Vibrato / Chor)" },
                { value: "filter", label: "Filter Cutoff (Wah)" },
                { value: "tremolo", label: "Amplitude (Tremolo)" },
              ]}
            />

            <Slider
              tone="accent"
              label="LFO Rate"
              valueDisplay={`${params.lfoRate.toFixed(1)} Hz`}
              min={0.1}
              max={20}
              step={0.1}
              value={params.lfoRate}
              onChange={(val) => handleParamChange("lfoRate", val)}
            />

            <Slider
              tone="accent"
              label="LFO Depth"
              valueDisplay={`${params.lfoDepth.toFixed(1)}`}
              min={0}
              max={30}
              step={0.5}
              value={params.lfoDepth}
              onChange={(val) => handleParamChange("lfoDepth", val)}
            />

            <Slider
              tone="accent"
              label="Waveguide Feedback"
              valueDisplay={`${Math.round(params.ksFeed * 100)}%`}
              min={0}
              max={0.9}
              step={0.02}
              value={params.ksFeed}
              onChange={(val) => handleParamChange("ksFeed", val)}
            />
          </div>
        </Card>

        {/* 5. Amplitude ADSR */}
        <Card
          elevation="low"
          className="bg-[#0e121a] border border-[#1f2533] rounded-xl p-2.5 flex flex-col justify-between min-w-[170px] max-w-[210px] flex-1 shadow-sm"
        >
          <span className="text-[11px] font-bold tracking-wider text-[#d4a359] uppercase mb-1 block">
            5. Amplitude ADSR
          </span>

          <div className="space-y-1.5 flex-1 flex flex-col justify-between">
            <Slider
              tone="accent"
              label="Attack"
              valueDisplay={`${params.attack.toFixed(3)} s`}
              min={0.001}
              max={1.0}
              step={0.005}
              value={params.attack}
              onChange={(val) => handleParamChange("attack", val)}
            />

            <Slider
              tone="accent"
              label="Decay"
              valueDisplay={`${params.decay.toFixed(1)} s`}
              min={0.05}
              max={5.0}
              step={0.05}
              value={params.decay}
              onChange={(val) => handleParamChange("decay", val)}
            />

            <Slider
              tone="accent"
              label="Sustain"
              valueDisplay={`${params.sustain.toFixed(2)}`}
              min={0}
              max={1.0}
              step={0.02}
              value={params.sustain}
              onChange={(val) => handleParamChange("sustain", val)}
            />

            <Slider
              tone="accent"
              label="Release"
              valueDisplay={`${params.release.toFixed(2)} s`}
              min={0.02}
              max={2.5}
              step={0.02}
              value={params.release}
              onChange={(val) => handleParamChange("release", val)}
            />
          </div>
        </Card>

        {/* 6. Body & Space */}
        <Card
          elevation="low"
          className="bg-[#0e121a] border border-[#1f2533] rounded-xl p-2.5 flex flex-col justify-between min-w-[170px] max-w-[210px] flex-1 shadow-sm"
        >
          <span className="text-[11px] font-bold tracking-wider text-[#d4a359] uppercase mb-1 block">
            6. Body & Space
          </span>

          <div className="space-y-1.5 flex-1 flex flex-col justify-between">
            <Slider
              tone="accent"
              label="Soundboard EQ"
              valueDisplay={`${params.lowEq >= 0 ? `+${params.lowEq.toFixed(1)}` : params.lowEq.toFixed(1)} dB`}
              min={-12}
              max={12}
              step={0.5}
              value={params.lowEq}
              onChange={(val) => handleParamChange("lowEq", val)}
            />

            <Slider
              tone="accent"
              label="Tube Drive"
              valueDisplay={`${Math.round(params.drive * 100)}%`}
              min={0}
              max={1}
              step={0.02}
              value={params.drive}
              onChange={(val) => handleParamChange("drive", val)}
            />

            <Slider
              tone="accent"
              label="Reverb Ambience"
              valueDisplay={`${Math.round(params.reverb * 100)}%`}
              min={0}
              max={0.8}
              step={0.02}
              value={params.reverb}
              onChange={(val) => handleParamChange("reverb", val)}
            />

            <Slider
              tone="accent"
              label="Master Output"
              valueDisplay={`${Math.round(params.masterVol * 100)}%`}
              min={0}
              max={1}
              step={0.02}
              value={params.masterVol}
              onChange={(val) => handleParamChange("masterVol", val)}
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SynthControls;
