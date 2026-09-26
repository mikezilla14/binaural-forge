export interface BeatEvent {
  id: string;
  timeOffset: number; // in seconds
  carrierFreq: number; // Hz
  beatFreq: number; // Hz
  volume: number; // 0-100
  fadeType?: 'linear' | 'exponential';
}

export enum NoiseType {
  OFF = 'OFF',
  WHITE = 'WHITE',
  PINK = 'PINK',
  BROWN = 'BROWN',
}

export interface AudioFilters {
  lowPassCutoff: number;
  resonance: number;
}

export enum ViewMode {
  STUDIO = 'STUDIO',
  AI_FORGE = 'AI_FORGE',
  LIBRARY = 'LIBRARY',
  FOCUS = 'FOCUS',
}

export interface TimerState {
  isActive: boolean;
  remainingSeconds: number;
  initialSeconds: number;
}

export enum BreathingPattern {
  OFF = 'OFF',
  BOX = 'BOX', // 4-4-4-4
  RELAX = 'RELAX', // 4-7-8
  COHERENCE = 'COHERENCE', // 5-5
}

export interface BreathingState {
  pattern: BreathingPattern;
  phase: 'inhale' | 'hold_in' | 'exhale' | 'hold_out';
  progress: number; // 0 to 1
}
