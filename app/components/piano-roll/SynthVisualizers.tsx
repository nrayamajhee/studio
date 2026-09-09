import React from "react";
import { cn } from "../../lib/utils";
import { Card } from "../design-system/Card";
import { Caption } from "../design-system/Typography";
import type { SynthFilterType, EnvelopeMode, EffectsMode } from "../../lib/synth";

export interface ExciterVisualizerProps {
  mode: "thud" | "noise" | "click" | "drum" | "off";
  vol: number;
  freq: number;
  decay: number;
  className?: string;
}

export const ExciterVisualizer: React.FC<ExciterVisualizerProps> = ({
  mode,
  vol,
  freq,
  decay,
  className,
}) => {
  const width = 180;
  const height = 36;
  const midY = 18;

  let pathData = `M 10 ${midY}`;
  let color = "#f59e0b"; // amber

  if (mode === "off") {
    pathData = `M 10 ${midY} L 170 ${midY}`;
    color = "#64748b";
  } else if (mode === "thud") {
    color = "#f59e0b";
    const points: string[] = [];
    const decayRate = 3 / Math.max(0.01, decay / 0.2);
    const cycles = 2 + (freq / 4000) * 4;
    for (let x = 10; x <= 170; x += 2) {
      const t = (x - 10) / 160;
      const env = vol * Math.exp(-t * decayRate);
      const y = midY - env * 13 * Math.sin(t * Math.PI * 2 * cycles);
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    pathData = `M ${points.join(" L ")}`;
  } else if (mode === "click") {
    color = "#06b6d4"; // cyan
    const points: string[] = [];
    for (let x = 10; x <= 170; x += 2) {
      const t = (x - 10) / 160;
      let y = midY;
      if (t < 0.04) {
        y = midY - vol * 14 * (t / 0.04);
      } else if (t < 0.12) {
        const ringT = (t - 0.04) / 0.08;
        y = midY + vol * 14 * Math.cos(ringT * Math.PI * 3) * Math.exp(-ringT * 3);
      } else {
        y = midY;
      }
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    pathData = `M ${points.join(" L ")}`;
  } else if (mode === "noise") {
    color = "#a855f7"; // purple
    const points: string[] = [];
    const decayRate = 3.5 / Math.max(0.01, decay / 0.2);
    for (let x = 10; x <= 170; x += 2) {
      const t = (x - 10) / 160;
      const env = vol * Math.exp(-t * decayRate);
      const pseudoNoise =
        Math.sin(x * 93.7) * 0.6 + Math.cos(x * 43.1) * 0.4;
      const y = midY - env * 14 * pseudoNoise;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    pathData = `M ${points.join(" L ")}`;
  } else if (mode === "drum") {
    color = "#f43f5e"; // rose
    const points: string[] = [];
    const decayRate = 2.5 / Math.max(0.01, decay / 0.2);
    for (let x = 10; x <= 170; x += 2) {
      const t = (x - 10) / 160;
      const env = vol * Math.exp(-t * decayRate);
      const pitchSweep = 1.5 + (1 - t) * 4;
      const y = midY - env * 14 * Math.sin(t * Math.PI * 2 * pitchSweep);
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    pathData = `M ${points.join(" L ")}`;
  }

  return (
    <Card
      elevation="low"
      className={cn(
        "w-full h-9 rounded-md bg-stone-900 dark:bg-stone-950 border border-stone-200/80 dark:border-stone-800 overflow-hidden relative shadow-2xs flex items-center justify-center p-0.5",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <line
          x1="10"
          y1={midY}
          x2="170"
          y2={midY}
          stroke="currentColor"
          className="text-stone-300/40 dark:text-stone-800"
          strokeDasharray="2,2"
          strokeWidth="1"
        />
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <Caption className="absolute top-1 right-1.5 flex items-center gap-1 text-[8px] font-mono leading-none tracking-tight text-stone-400 dark:text-stone-500 select-none">
        <span style={{ color }}>{mode === "off" ? "BYPASS (OFF)" : mode.toUpperCase()}</span>
        {mode !== "off" && (
          <span>• {(decay * 1000).toFixed(0)}ms</span>
        )}
      </Caption>
    </Card>
  );
};

export interface ToneCoreVisualizerProps {
  osc1Wave: OscillatorType | "off";
  osc2Wave: OscillatorType | "off";
  detune: number;
  osc2Oct: number;
  className?: string;
}

export const ToneCoreVisualizer: React.FC<ToneCoreVisualizerProps> = ({
  osc1Wave,
  osc2Wave,
  detune,
  osc2Oct,
  className,
}) => {
  const width = 180;
  const height = 36;
  const midY = 18;

  const waveVal = (type: OscillatorType, theta: number): number => {
    const norm = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (type === "sine") {
      return Math.sin(norm);
    }
    if (type === "sawtooth") {
      return (norm / Math.PI) - 1;
    }
    if (type === "square") {
      return norm < Math.PI ? 0.85 : -0.85;
    }
    if (type === "triangle") {
      const saw = (norm / Math.PI) - 1;
      return 2 * Math.abs(saw) - 1;
    }
    return 0;
  };

  const pointsComposite: string[] = [];
  const pointsOsc1: string[] = [];
  const pointsOsc2: string[] = [];

  const isOsc1Active = osc1Wave !== "off";
  const isOsc2Active = osc2Wave !== "off";
  const freqRatio = Math.pow(2, osc2Oct / 12) * Math.pow(2, detune / 1200);

  for (let x = 10; x <= 170; x += 2) {
    const t = (x - 10) / 160;
    let v1 = 0;
    if (isOsc1Active) {
      const theta1 = t * Math.PI * 4;
      v1 = waveVal(osc1Wave as OscillatorType, theta1);
      pointsOsc1.push(`${x.toFixed(1)},${(midY - v1 * 6).toFixed(1)}`);
    }

    let compositeV = 0;
    if (isOsc1Active && isOsc2Active) {
      const theta2 = t * Math.PI * 4 * freqRatio;
      const v2 = waveVal(osc2Wave as OscillatorType, theta2);
      pointsOsc2.push(`${x.toFixed(1)},${(midY - v2 * 6).toFixed(1)}`);
      compositeV = 0.52 * v1 + 0.48 * v2;
    } else if (isOsc1Active) {
      compositeV = v1;
    } else if (isOsc2Active) {
      const theta2 = t * Math.PI * 4 * freqRatio;
      const v2 = waveVal(osc2Wave as OscillatorType, theta2);
      pointsOsc2.push(`${x.toFixed(1)},${(midY - v2 * 6).toFixed(1)}`);
      compositeV = v2;
    }

    const y = midY - compositeV * 13;
    pointsComposite.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const strokeColor =
    !isOsc1Active && !isOsc2Active
      ? "#64748b"
      : isOsc1Active && isOsc2Active
        ? "#6366f1"
        : isOsc1Active
          ? "#6366f1"
          : "#f59e0b";

  return (
    <Card
      elevation="low"
      className={cn(
        "w-full h-9 rounded-md bg-stone-900 dark:bg-stone-950 border border-stone-200/80 dark:border-stone-800 overflow-hidden relative shadow-2xs flex items-center justify-center p-0.5",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <line
          x1="10"
          y1={midY}
          x2="170"
          y2={midY}
          stroke="currentColor"
          className="text-stone-300/40 dark:text-stone-800"
          strokeDasharray="2,2"
          strokeWidth="1"
        />

        {isOsc1Active && isOsc2Active && (
          <path
            d={`M ${pointsOsc1.join(" L ")}`}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1"
            strokeDasharray="2,2"
            opacity="0.35"
          />
        )}

        {isOsc1Active && isOsc2Active && (
          <path
            d={`M ${pointsOsc2.join(" L ")}`}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="1"
            strokeDasharray="2,2"
            opacity="0.35"
          />
        )}

        <path
          d={`M ${pointsComposite.join(" L ")}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <Caption className="absolute top-1 right-1.5 flex items-center gap-1 text-[8px] font-mono leading-none tracking-tight text-stone-400 dark:text-stone-500 select-none">
        {!isOsc1Active && !isOsc2Active ? (
          <span className="text-stone-400 font-bold">ALL OFF</span>
        ) : isOsc1Active && isOsc2Active ? (
          <>
            <span className="text-indigo-400 font-bold">COMPOSITE</span>
            <span>{detune > 0 ? `+${detune.toFixed(1)}¢` : "UNISON"}</span>
          </>
        ) : isOsc1Active ? (
          <span className="text-indigo-400 font-bold">
            OSC 1 ({osc1Wave.toUpperCase()})
          </span>
        ) : (
          <span className="text-amber-400 font-bold">
            OSC 2 ({osc2Wave.toUpperCase()})
          </span>
        )}
      </Caption>
    </Card>
  );
};

export interface FilterVisualizerProps {
  filterType: SynthFilterType;
  cutoff: number;
  envMod: number;
  keytrack: number;
  className?: string;
}

export const FilterVisualizer: React.FC<FilterVisualizerProps> = ({
  filterType,
  cutoff,
  envMod,
  className,
}) => {
  const width = 180;
  const height = 36;
  const isBypassed = filterType === "off";

  const minFreq = 20;
  const maxFreq = 20000;
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);

  const freqToX = (f: number) => {
    const clamped = Math.max(minFreq, Math.min(maxFreq, f));
    const logF = Math.log10(clamped);
    return 10 + 160 * ((logF - logMin) / (logMax - logMin));
  };

  const cutoffX = freqToX(cutoff);
  const envCutoffX = freqToX(cutoff + envMod);

  const points: string[] = [];
  const sampleSteps = 40;

  for (let i = 0; i <= sampleSteps; i++) {
    const frac = i / sampleSteps;
    const f = Math.pow(10, logMin + frac * (logMax - logMin));
    const x = 10 + 160 * frac;
    const ratio = f / Math.max(20, cutoff);

    let y = 14;
    if (isBypassed) {
      y = 14;
    } else if (filterType === "lowpass") {
      if (ratio < 0.8) {
        y = 12;
      } else if (ratio < 1.1) {
        y = 7;
      } else {
        const drop = Math.min(23, (ratio - 1) * 18);
        y = 12 + drop;
      }
    } else if (filterType === "highpass") {
      if (ratio > 1.25) {
        y = 12;
      } else if (ratio > 0.9) {
        y = 7;
      } else {
        const drop = Math.min(23, (1 - ratio) * 22);
        y = 12 + drop;
      }
    } else if (filterType === "bandpass") {
      const dist = Math.abs(Math.log2(ratio));
      y = Math.min(32, 7 + dist * 14);
    } else if (filterType === "notch") {
      const dist = Math.abs(Math.log2(ratio));
      if (dist < 0.2) {
        y = 32;
      } else if (dist < 0.8) {
        y = 12 + (1 - dist / 0.8) * 16;
      } else {
        y = 12;
      }
    }

    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const fillPath = `M ${points[0]} L ${points.join(" L ")} L 170 34 L 10 34 Z`;
  const strokeColor = isBypassed ? "#64748b" : "#06b6d4";

  return (
    <Card
      elevation="low"
      className={cn(
        "w-full h-9 rounded-md bg-stone-900 dark:bg-stone-950 border border-stone-200/80 dark:border-stone-800 overflow-hidden relative shadow-2xs flex items-center justify-center p-0.5",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="filterCurveGrad" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={strokeColor}
              stopOpacity={isBypassed ? 0.08 : 0.25}
            />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        <path d={fillPath} fill="url(#filterCurveGrad)" />

        <path
          d={`M ${points.join(" L ")}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {!isBypassed && (
          <>
            <line
              x1={cutoffX}
              y1="5"
              x2={cutoffX}
              y2="33"
              stroke="#06b6d4"
              strokeWidth="1"
              strokeDasharray="2,2"
              opacity="0.8"
            />
            <circle cx={cutoffX} cy="10" r="2" fill="#06b6d4" />
          </>
        )}

        {!isBypassed && envMod > 0 && (
          <line
            x1={envCutoffX}
            y1="5"
            x2={envCutoffX}
            y2="33"
            stroke="#a855f7"
            strokeWidth="1"
            strokeDasharray="1.5,1.5"
            opacity="0.6"
          />
        )}
      </svg>

      <Caption className="absolute top-1 right-1.5 flex items-center gap-1 text-[8px] font-mono leading-none tracking-tight text-stone-400 dark:text-stone-500 select-none">
        {isBypassed ? (
          <>
            <span className="text-stone-400 font-bold">BYPASS (OFF)</span>
            <span>• FLAT</span>
          </>
        ) : (
          <>
            <span className="text-cyan-400 font-bold">
              {filterType.toUpperCase()}
            </span>
            <span>• {Math.round(cutoff)}Hz</span>
          </>
        )}
      </Caption>
    </Card>
  );
};

export interface LfoVisualizerProps {
  dest: string;
  rate: number;
  depth: number;
  ksFeed: number;
  className?: string;
}

export const LfoVisualizer: React.FC<LfoVisualizerProps> = ({
  dest,
  rate,
  depth,
  className,
}) => {
  const width = 180;
  const height = 36;
  const midY = 18;
  const isOff = dest === "off" || depth === 0;

  const points: string[] = [];
  const cycles = Math.max(1, Math.min(5, rate * 0.35 + 0.8));
  const amp = Math.max(1, depth * 13);

  for (let x = 10; x <= 170; x += 2) {
    const t = (x - 10) / 160;
    const y = isOff ? midY : midY - amp * Math.sin(t * Math.PI * 2 * cycles);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const strokeColor = isOff ? "#64748b" : "#10b981";

  return (
    <Card
      elevation="low"
      className={cn(
        "w-full h-9 rounded-md bg-stone-900 dark:bg-stone-950 border border-stone-200/80 dark:border-stone-800 overflow-hidden relative shadow-2xs flex items-center justify-center p-0.5",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <line
          x1="10"
          y1={midY}
          x2="170"
          y2={midY}
          stroke="currentColor"
          className="text-stone-300/40 dark:text-stone-800"
          strokeDasharray="2,2"
          strokeWidth="1"
        />
        <path
          d={`M ${points.join(" L ")}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <Caption className="absolute top-1 right-1.5 flex items-center gap-1 text-[8px] font-mono leading-none tracking-tight text-stone-400 dark:text-stone-500 select-none">
        {isOff ? (
          <span className="text-stone-400 font-bold">DISABLED (OFF)</span>
        ) : (
          <>
            <span className="text-emerald-400 font-bold">
              {dest.toUpperCase()}
            </span>
            <span>• {rate.toFixed(1)}Hz</span>
          </>
        )}
      </Caption>
    </Card>
  );
};

export interface AdsrVisualizerProps {
  envMode?: EnvelopeMode;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  className?: string;
}

export const AdsrVisualizer: React.FC<AdsrVisualizerProps> = ({
  envMode = "adsr",
  attack,
  decay,
  sustain,
  release,
  className,
}) => {
  const width = 180;
  const height = 36;
  const startX = 12;
  const endX = 168;
  const totalW = endX - startX;
  const baseY = 30;
  const peakY = 8;

  let curvePath = "";
  let fillPath = "";
  let strokeColor = "#8b5cf6";

  if (envMode === "off") {
    strokeColor = "#64748b";
    curvePath = `M ${startX} ${peakY} L ${endX} ${peakY}`;
    fillPath = `M ${startX} ${peakY} L ${endX} ${peakY} L ${endX} ${baseY} L ${startX} ${baseY} Z`;
  } else if (envMode === "gate") {
    strokeColor = "#8b5cf6";
    curvePath = `M ${startX} ${baseY} L ${startX + 3} ${peakY} L ${endX - 14} ${peakY} L ${endX} ${baseY}`;
    fillPath = `${curvePath} L ${endX} ${baseY} L ${startX} ${baseY} Z`;
  } else {
    const rawA = (attack / 1.0) * 45 + 10;
    const rawD = (decay / 5.0) * 45 + 10;
    const rawR = (release / 2.5) * 45 + 10;
    const rawS = 30;
    const sumRaw = rawA + rawD + rawR + rawS;

    const wA = (rawA / sumRaw) * totalW;
    const wD = (rawD / sumRaw) * totalW;
    const wS = (rawS / sumRaw) * totalW;
    const wR = (rawR / sumRaw) * totalW;

    const susY = baseY - sustain * (baseY - peakY);

    const p0 = { x: startX, y: baseY };
    const pA = { x: startX + wA, y: peakY };
    const pD = { x: startX + wA + wD, y: susY };
    const pS = { x: startX + wA + wD + wS, y: susY };
    const pR = { x: startX + wA + wD + wS + wR, y: baseY };

    curvePath = `M ${p0.x} ${p0.y} L ${pA.x.toFixed(1)} ${pA.y.toFixed(1)} L ${pD.x.toFixed(1)} ${pD.y.toFixed(1)} L ${pS.x.toFixed(1)} ${pS.y.toFixed(1)} L ${pR.x.toFixed(1)} ${pR.y.toFixed(1)}`;
    fillPath = `${curvePath} L ${endX} ${baseY} L ${startX} ${baseY} Z`;
  }

  return (
    <Card
      elevation="low"
      className={cn(
        "w-full h-9 rounded-md bg-stone-900 dark:bg-stone-950 border border-stone-200/80 dark:border-stone-800 overflow-hidden relative shadow-2xs flex items-center justify-center p-0.5",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="adsrGrad" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={strokeColor}
              stopOpacity={envMode === "off" ? 0.1 : 0.3}
            />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <path d={fillPath} fill="url(#adsrGrad)" />
        <path
          d={curvePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <Caption className="absolute top-1 right-1.5 flex items-center gap-1 text-[8px] font-mono leading-none tracking-tight text-stone-400 dark:text-stone-500 select-none">
        {envMode === "off" ? (
          <>
            <span className="text-stone-400 font-bold">BYPASS (OFF)</span>
            <span>• FULL ON</span>
          </>
        ) : envMode === "gate" ? (
          <>
            <span className="text-purple-400 font-bold">GATE</span>
            <span>• HOLD</span>
          </>
        ) : (
          <>
            <span className="text-purple-400 font-bold">ADSR</span>
            <span>• S: {Math.round(sustain * 100)}%</span>
          </>
        )}
      </Caption>
    </Card>
  );
};

export interface BodySpaceVisualizerProps {
  fxMode?: EffectsMode;
  lowEq: number;
  drive: number;
  reverb: number;
  masterVol: number;
  className?: string;
}

export const BodySpaceVisualizer: React.FC<BodySpaceVisualizerProps> = ({
  fxMode = "all",
  drive,
  reverb,
  className,
}) => {
  const width = 180;
  const height = 36;
  const midY = 18;

  const isFxOff = fxMode === "off";
  const isDriveActive = !isFxOff && (fxMode === "all" || fxMode === "drive");
  const isReverbActive = !isFxOff && (fxMode === "all" || fxMode === "reverb");

  const drivePoints: string[] = [];
  const driveGain = isDriveActive ? 1 + drive * 4 : 1;
  for (let x = 10; x <= 80; x += 2) {
    const normX = (x - 45) / 35;
    const satY = isDriveActive ? Math.tanh(normX * driveGain) : normX * 0.75;
    const y = midY - satY * 11;
    drivePoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const reflectionCount = 7;
  const reflections: { x: number; h: number }[] = [];
  if (isReverbActive) {
    const decayConst = 2.5 / Math.max(0.1, reverb);
    for (let i = 0; i < reflectionCount; i++) {
      const t = i / (reflectionCount - 1);
      const x = 96 + t * 70;
      const h = Math.max(
        2,
        12 * Math.exp(-t * decayConst) * (0.3 + reverb * 0.7),
      );
      reflections.push({ x, h });
    }
  }

  const driveColor = isDriveActive ? "#f97316" : "#64748b";

  return (
    <Card
      elevation="low"
      className={cn(
        "w-full h-9 rounded-md bg-stone-900 dark:bg-stone-950 border border-stone-200/80 dark:border-stone-800 overflow-hidden relative shadow-2xs flex items-center justify-center p-0.5",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <path
          d={`M ${drivePoints.join(" L ")}`}
          fill="none"
          stroke={driveColor}
          strokeWidth="1.75"
          strokeLinecap="round"
        />

        <line
          x1="88"
          y1="6"
          x2="88"
          y2="30"
          stroke="currentColor"
          className="text-stone-300/40 dark:text-stone-800"
          strokeDasharray="2,2"
          strokeWidth="1"
        />

        {reflections.map((r, idx) => (
          <line
            key={idx}
            x1={r.x}
            y1={midY - r.h}
            x2={r.x}
            y2={midY + r.h}
            stroke="#38bdf8"
            strokeWidth="2"
            strokeLinecap="round"
            opacity={0.3 + (1 - idx / reflectionCount) * 0.7}
          />
        ))}

        {!isReverbActive && (
          <line
            x1="96"
            y1={midY}
            x2="166"
            y2={midY}
            stroke="#64748b"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        )}
      </svg>
      <Caption className="absolute top-1 right-1.5 flex items-center gap-1.5 text-[8px] font-mono leading-none tracking-tight text-stone-400 dark:text-stone-500 select-none">
        {isFxOff ? (
          <>
            <span className="text-stone-400 font-bold">BYPASS (OFF)</span>
            <span className="text-stone-400">100% DRY</span>
          </>
        ) : (
          <>
            <span
              className={
                isDriveActive
                  ? "text-orange-400 font-bold"
                  : "text-stone-500 font-medium"
              }
            >
              {isDriveActive ? `SAT ${Math.round(drive * 100)}%` : "SAT OFF"}
            </span>
            <span
              className={
                isReverbActive
                  ? "text-sky-400 font-bold"
                  : "text-stone-500 font-medium"
              }
            >
              {isReverbActive ? `REV ${Math.round(reverb * 100)}%` : "REV OFF"}
            </span>
          </>
        )}
      </Caption>
    </Card>
  );
};
