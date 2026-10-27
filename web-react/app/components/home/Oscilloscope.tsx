import { useEffect, useRef } from "react";

export type OscilloscopeProps = {
  getAnalyser: () => AnalyserNode | null;
  className?: string;
};

const GRID_ALPHA = 0.16;

// Live output waveform, triggered on a rising zero crossing so periodic tones
// stand still. Draws a flat line until audio starts. The trace and its centre
// line take the canvas's CSS color, so they follow the theme.
export function Oscilloscope({ getAnalyser, className }: OscilloscopeProps) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    let frame = 0;
    let samples: Float32Array<ArrayBuffer> | null = null;

    const draw = () => {
      frame = requestAnimationFrame(draw);
      const ratio = window.devicePixelRatio || 1;
      const width = Math.round(element.clientWidth * ratio);
      const height = Math.round(element.clientHeight * ratio);
      if (element.width !== width || element.height !== height) {
        element.width = width;
        element.height = height;
      }
      context.clearRect(0, 0, width, height);
      const mid = height / 2;
      const ink = getComputedStyle(element).color;

      context.setLineDash([3 * ratio, 5 * ratio]);
      context.strokeStyle = ink;
      context.globalAlpha = GRID_ALPHA;
      context.lineWidth = ratio;
      context.beginPath();
      context.moveTo(0, mid);
      context.lineTo(width, mid);
      context.stroke();
      context.setLineDash([]);
      context.globalAlpha = 1;
      context.lineWidth = 2.5 * ratio;
      context.lineJoin = "round";
      context.lineCap = "round";
      context.beginPath();
      const analyser = getAnalyser();
      if (!analyser) {
        context.moveTo(0, mid);
        context.lineTo(width, mid);
        context.stroke();
        return;
      }
      if (samples?.length !== analyser.fftSize) {
        samples = new Float32Array(analyser.fftSize);
      }
      analyser.getFloatTimeDomainData(samples);
      const span = Math.floor(samples.length / 2);
      let start = 0;
      for (let i = 1; i < samples.length - span; i++) {
        if (samples[i - 1] < 0 && samples[i] >= 0) {
          start = i;
          break;
        }
      }
      for (let x = 0; x < width; x++) {
        const sample = samples[start + Math.floor((x / width) * span)];
        const y = mid - Math.max(-1, Math.min(1, sample * 1.6)) * mid * 0.9;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [getAnalyser]);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
