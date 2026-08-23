import React, { useEffect, useRef } from 'react';
import { synth } from '../audio/synthEngine';

interface VisualizerProps {
  isPlaying: boolean;
}

export function Visualizer({ isPlaying }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      animationFrameId = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;

      // Clear with sleek dark background
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(0, 0, width, height);

      // Draw subtle oscilloscope grid lines
      ctx.strokeStyle = '#1e293b'; // slate-800
      ctx.lineWidth = 1;
      const gridCols = 8;
      const gridRows = 4;
      for (let i = 1; i < gridCols; i++) {
        ctx.beginPath();
        ctx.moveTo((width / gridCols) * i, 0);
        ctx.lineTo((width / gridCols) * i, height);
        ctx.stroke();
      }
      for (let i = 1; i < gridRows; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (height / gridRows) * i);
        ctx.lineTo(width, (height / gridRows) * i);
        ctx.stroke();
      }

      const analyser = synth.analyser;
      if (!analyser) {
        // Flat center line
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return;
      }

      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      // Neon Cyan Glow Waveform Line
      ctx.shadowBlur = isPlaying ? 12 : 2;
      ctx.shadowColor = '#06b6d4';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#22d3ee'; // cyan-400

      ctx.beginPath();
      const sliceWidth = (width * 1.0) / bufferLength;
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
      ctx.shadowBlur = 0; // reset
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  return (
    <div className="relative w-full bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-2xl p-1.5">
      <canvas
        ref={canvasRef}
        width={720}
        height={90}
        className="w-full h-20 rounded-lg bg-slate-950 block"
      />
    </div>
  );
}
