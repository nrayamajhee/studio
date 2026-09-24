import { useEffect, useRef } from "react";
import type { SynthParams } from "../../lib/synth";
import { cn } from "../../lib/utils";
import { Card } from "../design-system-v2";
import {
  ExciterVisualizer,
  ToneCoreVisualizer,
  FilterVisualizer,
  LfoVisualizer,
  AdsrVisualizer,
  BodySpaceVisualizer,
} from "../piano-roll/SynthVisualizers";
import type { SynthSection } from "./synthSections";
import styles from "./SynthScreen.module.css";

export interface SynthScreenProps {
  params: SynthParams;
  section: SynthSection;
  sectionIndex: number;
  sectionCount: number;
  showScope?: boolean;
  analyser?: AnalyserNode | null;
  modified?: boolean;
  className?: string;
}

export function SynthScreen({
  params,
  section,
  sectionIndex,
  sectionCount,
  showScope = false,
  analyser = null,
  modified = false,
  className,
}: SynthScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!showScope) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const data = new Uint8Array(analyser?.frequencyBinCount ?? 128);
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let frame = 0;

    const draw = () => {
      const { width, height } = canvas;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = "#44403c";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, height / 2);
      context.lineTo(width, height / 2);
      context.stroke();
      if (analyser) analyser.getByteTimeDomainData(data);
      else data.fill(128);
      context.strokeStyle = "#60a5fa";
      context.lineWidth = 2;
      context.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * width;
        const y = (data[i] / 255) * height;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
      if (analyser && !reducedMotion) frame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frame);
  }, [analyser, showScope]);

  const visualization = () => {
    const className = styles.visualization;
    switch (section.id) {
      case "exciter":
        return (
          <ExciterVisualizer
            mode={params.exciterMode}
            vol={params.exciterVol}
            freq={params.exciterFreq}
            decay={params.exciterDecay}
            className={className}
          />
        );
      case "tone":
        return <ToneCoreVisualizer {...params} className={className} />;
      case "filter":
        return <FilterVisualizer {...params} className={className} />;
      case "modulation":
        return (
          <LfoVisualizer
            dest={params.lfoDest}
            rate={params.lfoRate}
            depth={params.lfoDepth}
            ksFeed={params.ksFeed}
            className={className}
          />
        );
      case "envelope":
        return <AdsrVisualizer {...params} className={className} />;
      case "effects":
        return <BodySpaceVisualizer {...params} className={className} />;
    }
  };

  return (
    <Card
      variant="solid"
      className={cn("dark", styles.screen, className)}
      role="group"
      aria-label={`${section.title} synthesizer parameters`}
    >
      <div className={styles.header}>
        <span className={styles.preset}>
          {params.name}
          {modified ? " •" : ""}
        </span>
        <span className={styles.counter}>
          {String(sectionIndex + 1).padStart(2, "0")} /{" "}
          {String(sectionCount).padStart(2, "0")}
        </span>
      </div>
      {showScope && (
        <canvas
          ref={canvasRef}
          width={640}
          height={96}
          className={styles.scope}
          role="img"
          aria-label="Live synthesizer waveform"
        />
      )}
      <h2 className={styles.title}>{section.title}</h2>
      {visualization()}
      <dl className={styles.parameters}>
        {section.controls.map((control) => (
          <div key={control.label}>
            <dt>{control.label}</dt>
            <dd>{control.display(params)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
