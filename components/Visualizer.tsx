import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';

export const Visualizer: React.FC<{ isPlaying: boolean }> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const bufferLength = audioEngine.analyserLeft?.frequencyBinCount || 256;
    const timeDataL = new Uint8Array(bufferLength);
    const timeDataR = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Subtle trails
      ctx.fillStyle = 'rgba(13, 17, 23, 0.2)';
      ctx.fillRect(0, 0, width, height);

      if (!isPlaying || !audioEngine.analyserLeft || !audioEngine.analyserRight) {
        // Idle animation: subtle breathing horizontal line
        const breathing = (Math.sin(Date.now() / 1000) + 1) / 2;
        ctx.strokeStyle = `rgba(59, 130, 246, ${0.1 + breathing * 0.1})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        animationId = requestAnimationFrame(draw);
        return;
      }

      audioEngine.analyserLeft.getByteTimeDomainData(timeDataL);
      audioEngine.analyserRight.getByteTimeDomainData(timeDataR);
      audioEngine.analyserLeft.getByteFrequencyData(freqData);

      // Draw Frequency Background (Lush Gradient)
      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (freqData[i] / 255) * height;
        const opacity = (freqData[i] / 255) * 0.2;
        ctx.fillStyle = `rgba(59, 130, 246, ${opacity})`;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }

      // Draw Time-Domain Waveforms
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // Left Channel (Cyan)
      ctx.strokeStyle = '#22d3ee';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#22d3ee';
      ctx.beginPath();
      const sliceWidth = width / bufferLength;
      x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = timeDataL[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();

      // Right Channel (Purple)
      ctx.strokeStyle = '#a855f7';
      ctx.shadowColor = '#a855f7';
      ctx.beginPath();
      x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = timeDataR[i] / 128.0;
        const y = (v * height) / 2 + (height / 4);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
      
      ctx.shadowBlur = 0; // Reset for next frame
      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying]);

  return (
    <div className="w-full h-24 sm:h-40 bg-gray-950 rounded-xl overflow-hidden border border-gray-800 shadow-2xl relative">
      <canvas ref={canvasRef} width={800} height={160} className="w-full h-full block" />
      <div className="absolute inset-x-0 bottom-2 px-4 flex justify-between pointer-events-none">
          <div className="text-[6px] sm:text-[8px] font-mono text-gray-700 uppercase tracking-widest">Left Spectrogram</div>
          <div className="text-[6px] sm:text-[8px] font-mono text-gray-700 uppercase tracking-widest">Right Spectrogram</div>
      </div>
    </div>
  );
};
