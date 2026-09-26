import React, { useMemo } from 'react';
import { BeatEvent } from '../types';
import { Trash2, Edit } from 'lucide-react';

interface TimelineProps {
  events: BeatEvent[];
  duration: number;
  onEventClick: (event: BeatEvent) => void;
  onDeleteEvent: (id: string) => void;
  playbackTime: number;
}

export const Timeline: React.FC<TimelineProps> = ({ events, duration, onEventClick, onDeleteEvent, playbackTime }) => {
  const widthPercent = (time: number) => (time / duration) * 100;

  const segments = useMemo(() => {
    if (events.length < 2) return [];
    const segs = [];
    for (let i = 0; i < events.length - 1; i++) {
      const start = events[i];
      const end = events[i+1];
      segs.push({ start, end });
    }
    return segs;
  }, [events]);

  return (
    <div className="relative w-full h-48 sm:h-72 bg-gray-950/50 border border-gray-800 rounded-2xl overflow-hidden select-none mb-4 group/timeline shadow-inner">
      {/* Time Grid Labels */}
      <div className="absolute inset-x-0 bottom-0 h-6 sm:h-8 flex items-center text-[7px] sm:text-[9px] text-gray-600 font-mono px-2 sm:px-4 pointer-events-none border-t border-gray-900 bg-gray-900/20">
         <span className="flex-1">START</span>
         {[...Array(9)].map((_, i) => (
           <span key={i} className={`flex-1 text-center border-l border-gray-800 h-full flex items-center justify-center ${i % 2 === 0 ? 'hidden sm:flex' : 'flex'}`}>
             {new Date((duration * (i + 1) / 10) * 1000).toISOString().substr(14, 5)}
           </span>
         ))}
      </div>

      {/* Grid Lines */}
      <div className="absolute inset-0 flex pointer-events-none opacity-5">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="flex-1 border-r border-gray-400 h-full"></div>
        ))}
      </div>

      {/* Playhead */}
      <div 
        className="absolute top-0 bottom-8 w-0.5 bg-accent-400 z-40 transition-all duration-75 ease-linear pointer-events-none"
        style={{ left: `${widthPercent(playbackTime)}%` }}
      >
        <div className="w-3 h-3 bg-accent-400 rounded-full -ml-[5.5px] -mt-1 shadow-[0_0_15px_rgba(34,211,238,0.6)]" />
      </div>

      {/* Segments (Advanced Gradients) */}
      {segments.map((seg, idx) => (
        <div
          key={`seg-${seg.start.id}`}
          className="absolute top-12 bottom-12 sm:top-16 sm:bottom-16 bg-gradient-to-r from-purple-500/5 via-purple-500/10 to-purple-500/5 border-t border-b border-purple-500/10 group-hover/timeline:from-purple-500/10 group-hover/timeline:to-purple-500/10 transition-all"
          style={{
            left: `${widthPercent(seg.start.timeOffset)}%`,
            width: `${widthPercent(seg.end.timeOffset - seg.start.timeOffset)}%`
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center text-[7px] sm:text-[9px] text-purple-400/30 font-mono tracking-tighter uppercase font-bold">
             {Math.round(seg.end.timeOffset - seg.start.timeOffset)}s
          </div>
        </div>
      ))}

      {/* Event Points & Labels */}
      {events.map((evt) => {
        const leftPos = widthPercent(evt.timeOffset);
        const isRightSided = leftPos > 85;

        return (
          <div
            key={evt.id}
            className="absolute top-0 bottom-8 w-0 group z-30"
            style={{ left: `${leftPos}%` }}
          >
            {/* Vertical Marker */}
            <div className="absolute top-0 bottom-0 w-px bg-gray-800 group-hover:bg-accent-500/50 transition-colors shadow-glow"></div>
            
            {/* Professional Handle */}
            <div 
              className="absolute top-1/2 -mt-4 sm:-mt-6 -ml-[6px] sm:-ml-[8px] w-[12px] sm:w-[16px] h-[32px] sm:h-[48px] bg-gray-800 rounded sm:rounded-lg shadow-2xl cursor-pointer hover:bg-gray-700 hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5 sm:gap-1 border border-gray-700"
              onClick={() => onEventClick(evt)}
            >
              <div className="w-0.5 h-0.5 sm:h-1 bg-gray-600 rounded-full"></div>
              <div className="w-0.5 h-2 sm:h-4 bg-gray-500 rounded-full"></div>
              <div className="w-0.5 h-0.5 sm:h-1 bg-gray-600 rounded-full"></div>
            </div>

            {/* Premium Labels */}
            <div 
              className={`absolute top-2 sm:top-4 ${isRightSided ? 'right-2 sm:right-4 items-end' : 'left-2 sm:left-4 items-start'} flex flex-col pointer-events-none transition-all duration-300 opacity-60 group-hover:opacity-100 group-hover:translate-y-[-2px]`}
            >
               <div className="bg-gray-900/90 backdrop-blur-md border border-gray-800 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded sm:rounded-md text-[7px] sm:text-[9px] font-mono text-gray-400 whitespace-nowrap shadow-xl">
                  <span className="text-gray-600 mr-0.5 sm:mr-1">T+</span>{new Date(evt.timeOffset * 1000).toISOString().substr(14, 5)}
               </div>
               <div className="mt-0.5 sm:mt-1 bg-accent-950/80 backdrop-blur-md border border-accent-800/30 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded sm:rounded-md text-[8px] sm:text-[10px] font-mono text-accent-300 whitespace-nowrap shadow-xl flex items-center gap-0.5 sm:gap-1">
                  <span className="text-accent-600 font-bold">{evt.beatFreq.toFixed(1)}</span>
                  <span className="text-gray-600 text-[6px] sm:text-[8px]">Hz</span>
               </div>
            </div>

            {/* Refined Quick Actions */}
            <div className={`absolute bottom-4 ${isRightSided ? 'right-4' : 'left-4'} flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 p-1 bg-gray-900/95 border border-gray-800 rounded-lg shadow-2xl`}>
               <button onClick={(e) => { e.stopPropagation(); onEventClick(evt); }} className="p-1.5 bg-gray-800 hover:bg-accent-600 rounded-md text-gray-400 hover:text-white transition-all shadow-sm">
                  <Edit size={12} />
               </button>
               <button onClick={(e) => { e.stopPropagation(); onDeleteEvent(evt.id); }} className="p-1.5 bg-gray-800 hover:bg-red-600 rounded-md text-gray-400 hover:text-white transition-all shadow-sm">
                  <Trash2 size={12} />
               </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
