import React, { useState, useEffect, useRef } from 'react';
import { BreathingPattern, BreathingState } from '../types';

interface BreathingGuideProps {
  pattern: BreathingPattern;
  onPhaseProgress?: (progress: number) => void;
}

const PATTERNS: Record<BreathingPattern, number[]> = {
  [BreathingPattern.OFF]: [0, 0, 0, 0],
  [BreathingPattern.BOX]: [4, 4, 4, 4], // In, Hold, Out, Hold
  [BreathingPattern.RELAX]: [4, 7, 8, 0], // In, Hold, Out, Hold
  [BreathingPattern.COHERENCE]: [5, 0, 5, 0], // In, Hold, Out, Hold
};

export const BreathingGuide: React.FC<BreathingGuideProps> = ({ pattern, onPhaseProgress }) => {
  const [state, setState] = useState<BreathingState>({
    pattern,
    phase: 'inhale',
    progress: 0,
  });

  const requestRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (pattern === BreathingPattern.OFF) {
      cancelAnimationFrame(requestRef.current);
      if (onPhaseProgress) onPhaseProgress(0);
      return;
    }

    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = (time - startTimeRef.current) / 1000;
      
      const config = PATTERNS[pattern];
      const totalCycle = config.reduce((a, b) => a + b, 0);
      const cycleTime = elapsed % totalCycle;

      let currentPhase: BreathingState['phase'] = 'inhale';
      let phaseStart = 0;
      let phaseDuration = config[0];

      if (cycleTime < config[0]) {
        currentPhase = 'inhale';
        phaseDuration = config[0];
      } else if (cycleTime < config[0] + config[1]) {
        currentPhase = 'hold_in';
        phaseStart = config[0];
        phaseDuration = config[1];
      } else if (cycleTime < config[0] + config[1] + config[2]) {
        currentPhase = 'exhale';
        phaseStart = config[0] + config[1];
        phaseDuration = config[2];
      } else {
        currentPhase = 'hold_out';
        phaseStart = config[0] + config[1] + config[2];
        phaseDuration = config[3];
      }

      const progress = (cycleTime - phaseStart) / phaseDuration;
      const safeProgress = isNaN(progress) ? 0 : progress;

      // Map progress to intensity for audio ducking
      // We want the most ducking (intensity = 1.0) at peak inhale
      let intensity = 0;
      if (currentPhase === 'inhale') intensity = safeProgress;
      else if (currentPhase === 'hold_in') intensity = 1.0;
      else if (currentPhase === 'exhale') intensity = 1.0 - safeProgress;
      else intensity = 0;

      if (onPhaseProgress) onPhaseProgress(intensity);

      setState({
        pattern,
        phase: currentPhase,
        progress: safeProgress,
      });

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [pattern, onPhaseProgress]);

  if (pattern === BreathingPattern.OFF) return null;

  // Calculate visual scale
  let scale = 1;
  if (state.phase === 'inhale') scale = 1 + state.progress * 0.5;
  else if (state.phase === 'hold_in') scale = 1.5;
  else if (state.phase === 'exhale') scale = 1.5 - state.progress * 0.5;
  else scale = 1;

  const phaseLabels = {
    inhale: 'Inhale',
    hold_in: 'Hold',
    exhale: 'Exhale',
    hold_out: 'Hold',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500">
      <div className="relative flex items-center justify-center w-48 h-48">
        {/* Pulsing ring */}
        <div 
          className="absolute inset-0 rounded-full border-2 border-accent-500/20 transition-transform duration-100 ease-linear"
          style={{ transform: `scale(${scale * 1.2})` }}
        />
        {/* Inner circle */}
        <div 
          className="absolute inset-0 rounded-full bg-gradient-to-br from-accent-500/40 to-accent-600/10 backdrop-blur-md shadow-[0_0_30px_rgba(59,130,246,0.2)] transition-transform duration-100 ease-linear flex flex-col items-center justify-center border border-accent-500/20"
          style={{ transform: `scale(${scale})` }}
        >
          <span className="text-white font-bold tracking-widest uppercase text-[10px] drop-shadow-md">
            {phaseLabels[state.phase]}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold">Respiration Sync</span>
        <div className="w-32 h-1 bg-gray-800 rounded-full overflow-hidden">
           <div 
             className="h-full bg-accent-500 transition-all duration-100 ease-linear" 
             style={{ width: `${state.progress * 100}%` }} 
           />
        </div>
      </div>
    </div>
  );
};
