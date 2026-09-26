import React, { useState, useEffect } from 'react';
import { Clock, X, BellOff } from 'lucide-react';
import { TimerState } from '../types';

interface SleepTimerProps {
  onTimerEnd: () => void;
  isPlaying: boolean;
}

export const SleepTimer: React.FC<SleepTimerProps> = ({ onTimerEnd, isPlaying }) => {
  const [timer, setTimer] = useState<TimerState>({ isActive: false, remainingSeconds: 0, initialSeconds: 0 });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let interval: number;
    if (timer.isActive && timer.remainingSeconds > 0 && isPlaying) {
      interval = window.setInterval(() => {
        setTimer(prev => ({
          ...prev,
          remainingSeconds: prev.remainingSeconds - 1
        }));
      }, 1000);
    } else if (timer.isActive && timer.remainingSeconds <= 0 && isPlaying) {
      onTimerEnd();
      setTimer({ isActive: false, remainingSeconds: 0, initialSeconds: 0 });
    }
    return () => clearInterval(interval);
  }, [timer.isActive, timer.remainingSeconds, isPlaying, onTimerEnd]);

  const startTimer = (minutes: number) => {
    setTimer({
      isActive: true,
      remainingSeconds: minutes * 60,
      initialSeconds: minutes * 60
    });
    setIsOpen(false);
  };

  const cancelTimer = () => {
    setTimer({ isActive: false, remainingSeconds: 0, initialSeconds: 0 });
    setIsOpen(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm font-medium ${
          timer.isActive 
            ? 'bg-accent-600/20 border-accent-500/50 text-accent-400' 
            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
        }`}
      >
        <Clock size={16} className={timer.isActive ? 'animate-pulse' : ''} />
        {timer.isActive ? formatTime(timer.remainingSeconds) : <span className="hidden sm:inline">Sleep Timer</span>}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full right-0 mb-2 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 p-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-800">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Set Duration</span>
              <button onClick={() => setIsOpen(false)} className="text-gray-600 hover:text-white"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[5, 15, 30, 60].map(mins => (
                <button
                  key={mins}
                  onClick={() => startTimer(mins)}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded text-xs font-mono transition-colors border border-gray-700"
                >
                  {mins}m
                </button>
              ))}
            </div>
            {timer.isActive && (
              <button
                onClick={cancelTimer}
                className="w-full mt-3 bg-red-900/20 hover:bg-red-900/40 text-red-400 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition-all border border-red-900/30"
              >
                <BellOff size={12} /> Cancel Timer
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
