import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, Upload, Plus, FileCode, Activity, Music, 
  Volume2, Save, Wand2, RefreshCw, Bookmark, Trash2, Wind,
  Share2, Maximize2, Minimize2, Settings2, Sliders, Timer,
  ExternalLink, Search, Zap, Moon, Brain, Sun
} from 'lucide-react';
import { BeatEvent, ViewMode, NoiseType, BreathingPattern } from './types';
import { parseScript, generateScript } from './services/parser';
import { audioEngine } from './services/audioEngine';
import { Timeline } from './components/Timeline';
import { Visualizer } from './components/Visualizer';
import { EventEditor } from './components/EventEditor';
import { SleepTimer } from './components/SleepTimer';
import { BreathingGuide } from './components/BreathingGuide';
import { GoogleGenAI } from "@google/genai";

const DEFAULT_SCRIPT = `# Example Binaural Session
# Time  Carrier+Beat/Volume
00:00 200+10/50
01:00 200+8/50
05:00 150+4/60
10:00 150+4/0
`;

const STANDARD_PROTOCOLS = [
  { name: 'Deep Delta Sleep', icon: Moon, script: "00:00 180+2.5/50\n10:00 180+1.0/40\n30:00 180+1.0/0" },
  { name: 'Intense Alpha Flow', icon: Zap, script: "00:00 210+10.0/60\n15:00 210+12.0/60\n45:00 210+8.0/30" },
  { name: 'Gamma Sharp Focus', icon: Brain, script: "00:00 240+40.0/40\n10:00 240+40.0/50\n30:00 240+40.0/0" },
  { name: 'Theta Insight', icon: Sun, script: "00:00 190+6.0/50\n05:00 190+4.5/50\n20:00 190+4.5/0" },
];

interface Preset {
  id: string;
  name: string;
  script: string;
  date: number;
}

interface GroundingSource {
  title: string;
  uri: string;
}

function App() {
  const [script, setScript] = useState<string>(DEFAULT_SCRIPT);
  const [events, setEvents] = useState<BeatEvent[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.STUDIO);
  const [studioMode, setStudioMode] = useState<'timeline' | 'script'>('timeline');
  const [currentTime, setCurrentTime] = useState(0);
  const [editingEvent, setEditingEvent] = useState<BeatEvent | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [volume, setVolume] = useState(50);
  const [noiseLevel, setNoiseLevel] = useState(15);
  const [noiseType, setNoiseType] = useState<NoiseType>(NoiseType.PINK);
  const [filterCutoff, setFilterCutoff] = useState(2000);
  const [breathingPattern, setBreathingPattern] = useState<BreathingPattern>(BreathingPattern.OFF);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  
  const rafRef = useRef<number>(0);

  // Persistence: Auto-load & Shared
  useEffect(() => {
    const savedPresets = localStorage.getItem('bf_presets');
    if (savedPresets) {
      try { setPresets(JSON.parse(savedPresets)); } catch (e) {}
    }

    const lastSession = localStorage.getItem('bf_current_script');
    if (lastSession && script === DEFAULT_SCRIPT) {
      setScript(lastSession);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const shared = urlParams.get('s');
    if (shared) {
      try {
        const decoded = atob(shared);
        setScript(decoded);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {}
    }
  }, []);

  // Persistence: Auto-save
  useEffect(() => {
    localStorage.setItem('bf_current_script', script);
  }, [script]);

  // Sync Audio Engine
  useEffect(() => {
    const newEvents = parseScript(script);
    setEvents(newEvents);
    audioEngine.loadEvents(newEvents);
  }, [script]);

  const updateScriptFromEvents = useCallback((newEvents: BeatEvent[]) => {
    const sorted = [...newEvents].sort((a,b) => a.timeOffset - b.timeOffset);
    setEvents(sorted);
    const newScript = generateScript(sorted);
    setScript(newScript);
    audioEngine.loadEvents(sorted);
  }, []);

  const handlePlayToggle = () => {
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
    } else {
      audioEngine.init(); // Ensure context is initialized
      audioEngine.play(currentTime);
      setIsPlaying(true);
      const updateLoop = () => {
        setCurrentTime(audioEngine.getCurrentTime());
        rafRef.current = requestAnimationFrame(updateLoop);
      };
      updateLoop();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (isPlaying) audioEngine.play(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    audioEngine.setMasterVolume(val);
  };

  const handleNoiseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setNoiseLevel(val);
    audioEngine.setNoiseLevel(val);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setFilterCutoff(val);
    audioEngine.setFilterCutoff(val);
  };

  const handleNoiseTypeChange = (type: NoiseType) => {
    setNoiseType(type);
    audioEngine.setNoiseType(type);
  };

  const handleTimerEnd = () => {
    audioEngine.fadeOutAndStop(5);
    setIsPlaying(false);
    cancelAnimationFrame(rafRef.current);
  };

  const saveToPresets = () => {
    const name = prompt("Enter a name for this preset:", "Deep Meditation");
    if (!name) return;
    const newPreset: Preset = { id: `pre_${Date.now()}`, name, script, date: Date.now() };
    const updated = [newPreset, ...presets];
    setPresets(updated);
    localStorage.setItem('bf_presets', JSON.stringify(updated));
  };

  const handleShare = () => {
    try {
      const encoded = btoa(unescape(encodeURIComponent(script)));
      const url = `${window.location.origin}${window.location.pathname}?s=${encoded}`;
      navigator.clipboard.writeText(url).then(() => {
        alert("Shareable link copied to clipboard!");
      });
    } catch (e) {
      alert("Failed to generate share link. Script might be too large.");
    }
  };

  const loadPreset = (p: Preset | { name: string, script: string }) => {
    setScript(p.script);
    setCurrentTime(0);
    setViewMode(ViewMode.STUDIO);
    setStudioMode('timeline');
    
    // Automatically start playback for presets
    setTimeout(() => {
      audioEngine.init();
      audioEngine.play(0);
      setIsPlaying(true);
    }, 150);
  };

  const deletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    localStorage.setItem('bf_presets', JSON.stringify(updated));
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    setSources([]);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Research the scientific literature for optimal binaural frequencies and carriers for: "${aiPrompt}". Then create an SBaGen script. Format MM:SS Freq+Beat/Vol. Raw text only, no code blocks.`,
        config: { 
          systemInstruction: "You are a world-class neuro-acoustics researcher and audio engineer. Use Search to verify actual scientific data.",
          tools: [{ googleSearch: {} }]
        }
      });
      
      if (response.text) {
        setScript(response.text.replace(/```/g, '').trim());
        setAiPrompt("");
        setViewMode(ViewMode.STUDIO);
        setStudioMode('timeline');
        
        // Automatically start playback for AI generated scripts
        setTimeout(() => {
          audioEngine.init();
          audioEngine.play(0);
          setIsPlaying(true);
        }, 150);
        
        // Extract grounding sources if available
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
          const newSources = groundingChunks
            .filter((chunk: any) => chunk.web)
            .map((chunk: any) => ({
              title: chunk.web.title || "Research Source",
              uri: chunk.web.uri
            }));
          setSources(newSources);
        }
      }
    } catch (e) { console.error(e); }
    finally { setIsGenerating(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setScript(evt.target?.result as string);
      setViewMode(ViewMode.STUDIO);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownload = () => {
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'binaural_session.sbg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAudio = async () => {
    if (events.length === 0) return;
    setIsRendering(true);
    try {
      const duration = events[events.length - 1].timeOffset + 10; // Add 10s tail
      const blob = await audioEngine.renderToWav(events, duration, {
        volume,
        noiseLevel,
        noiseType,
        filterCutoff
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `binaural_render_${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to render audio.");
    } finally {
      setIsRendering(false);
    }
  };

  const handleExportLibrary = () => {
    const data = JSON.stringify(presets, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `binaural_library_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportLibrary = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target?.result as string);
        if (Array.isArray(imported)) {
          const merged = [...imported, ...presets];
          // Deduplicate by ID if necessary, but here we just merge
          setPresets(merged);
          localStorage.setItem('bf_presets', JSON.stringify(merged));
          alert(`Imported ${imported.length} presets.`);
        }
      } catch (e) {
        alert("Invalid library file.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleNewSequence = () => {
    if (window.confirm("Are you sure you want to clear the current sequence?")) {
      setScript(DEFAULT_SCRIPT);
      setCurrentTime(0);
    }
  };

  const handleAddEvent = () => {
    const { carrier, beat } = getCurrentValues();
    const newEvent: BeatEvent = {
      id: `evt_${Date.now()}`,
      timeOffset: currentTime,
      carrierFreq: carrier,
      beatFreq: beat,
      volume: 50,
    };
    updateScriptFromEvents([...events, newEvent]);
  };

  const handleDeleteEvent = (id: string) => {
    updateScriptFromEvents(events.filter(e => e.id !== id));
  };

  const handleEventUpdate = (updatedEvent: BeatEvent) => {
    const exists = events.some(e => e.id === updatedEvent.id);
    const newEvents = exists 
      ? events.map(e => e.id === updatedEvent.id ? updatedEvent : e)
      : [...events, updatedEvent];
    updateScriptFromEvents(newEvents);
    setEditingEvent(null);
  };

  const getCurrentValues = () => {
    if (events.length === 0) return { carrier: 0, beat: 0 };
    let startEvt = events[0];
    let endEvt = null;
    for (let i = 0; i < events.length; i++) {
        if (currentTime >= events[i].timeOffset) {
            startEvt = events[i];
            endEvt = events[i+1] || null;
        }
    }
    if (!endEvt) return { carrier: startEvt.carrierFreq, beat: startEvt.beatFreq };
    const progress = (currentTime - startEvt.timeOffset) / (endEvt.timeOffset - startEvt.timeOffset);
    return {
      carrier: startEvt.carrierFreq + (endEvt.carrierFreq - startEvt.carrierFreq) * progress,
      beat: startEvt.beatFreq + (endEvt.beatFreq - startEvt.beatFreq) * progress
    };
  };

  const { carrier: liveCarrier, beat: liveBeat } = getCurrentValues();
  const totalDuration = events.length > 0 ? events[events.length - 1].timeOffset + 60 : 600;

  if (viewMode === ViewMode.FOCUS) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center p-8 transition-all animate-in fade-in duration-700 overflow-hidden">
         <div className="absolute top-8 left-8 flex items-center gap-3 opacity-40">
            <Activity className="text-accent-500 animate-pulse" />
            <h1 className="text-xl font-bold tracking-tighter text-white">BinauralForge Focus</h1>
         </div>
         <button onClick={() => setViewMode(ViewMode.STUDIO)} className="absolute top-8 right-8 p-3 bg-gray-900 border border-gray-800 rounded-full text-gray-500 hover:text-white transition-all hover:scale-110 active:scale-90 shadow-2xl"><Minimize2 size={24} /></button>
         
         <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-12 text-center lg:text-left">
              <div className="space-y-4">
                <div className="text-8xl font-mono font-bold text-accent-400 tabular-nums tracking-tighter drop-shadow-[0_0_40px_rgba(59,130,246,0.3)]">
                   {liveBeat.toFixed(2)}<span className="text-xl text-gray-700 ml-2">Hz</span>
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-[0.4em] font-bold">Resonant Entropy: Entrainment Field Active</div>
              </div>
              
              <div className="h-24 opacity-60"><Visualizer isPlaying={isPlaying} /></div>

              <div className="flex items-center justify-center lg:justify-start gap-12">
                 <button onClick={handlePlayToggle} className={`w-32 h-32 rounded-full flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 ${isPlaying ? 'bg-red-500/10 text-red-400 border border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.1)]' : 'bg-accent-600 text-white shadow-[0_0_70px_rgba(59,130,246,0.4)]'}`}>
                    {isPlaying ? <Pause size={56} fill="currentColor" /> : <Play size={56} fill="currentColor" className="ml-2" />}
                 </button>
                 <div className="flex flex-col gap-8">
                    <div className="flex items-center gap-4 w-56 text-gray-500">
                       <Volume2 size={24} />
                       <input type="range" min="0" max="100" value={volume} onChange={handleVolumeChange} className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-accent-500" />
                    </div>
                    <div className="flex gap-4">
                       <SleepTimer isPlaying={isPlaying} onTimerEnd={handleTimerEnd} />
                       <select value={breathingPattern} onChange={(e) => setBreathingPattern(e.target.value as BreathingPattern)} className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-xs text-gray-300 outline-none shadow-xl focus:ring-2 focus:ring-accent-500 transition-all">
                          <option value={BreathingPattern.OFF}>Breathing: Off</option>
                          <option value={BreathingPattern.BOX}>Box (4-4-4-4)</option>
                          <option value={BreathingPattern.RELAX}>Relax (4-7-8)</option>
                          <option value={BreathingPattern.COHERENCE}>Coherence (5-5)</option>
                       </select>
                    </div>
                 </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center">
               <BreathingGuide pattern={breathingPattern} onPhaseProgress={(val) => audioEngine.setBreathingIntensity(val)} />
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans flex flex-col selection:bg-accent-500/30">
      <header className="bg-gray-900/90 border-b border-gray-800 p-3 sm:p-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur-xl">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-900 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-accent-900/30 transition-transform hover:scale-105 overflow-hidden border border-gray-800">
             <img src="/logo.png" alt="BinauralForge Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="hidden xs:block">
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">BinauralForge</h1>
            <p className="text-[8px] sm:text-[10px] text-accent-400 font-mono uppercase tracking-[0.2em]">Neural Architect v2.5</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
           <div className="flex bg-gray-800/50 rounded-lg sm:rounded-xl p-1 border border-gray-700/50">
             <button 
               onClick={() => setViewMode(ViewMode.STUDIO)} 
               className={`flex items-center gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg transition-all text-[10px] sm:text-xs font-bold ${viewMode === ViewMode.STUDIO ? 'bg-gray-700 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
             >
               <Music size={14} /> <span className="hidden md:inline">Studio</span>
             </button>
             <button 
               onClick={() => setViewMode(ViewMode.AI_FORGE)} 
               className={`flex items-center gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg transition-all text-[10px] sm:text-xs font-bold ${viewMode === ViewMode.AI_FORGE ? 'bg-gray-700 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
             >
               <Wand2 size={14} /> <span className="hidden md:inline">AI Forge</span>
             </button>
             <button 
               onClick={() => setViewMode(ViewMode.LIBRARY)} 
               className={`flex items-center gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg transition-all text-[10px] sm:text-xs font-bold ${viewMode === ViewMode.LIBRARY ? 'bg-gray-700 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
             >
               <Bookmark size={14} /> <span className="hidden md:inline">Library</span>
             </button>
             <button 
               onClick={() => setViewMode(ViewMode.FOCUS)} 
               className="p-1.5 sm:p-2.5 rounded-md sm:rounded-lg text-gray-400 hover:text-white transition-all"
               title="Focus Mode"
             >
               <Maximize2 size={14} />
             </button>
           </div>
           <div className="hidden sm:block h-6 w-px bg-gray-800 mx-1" />
           <div className="hidden sm:flex items-center gap-1.5 sm:gap-2">
             <button onClick={handleShare} className="bg-gray-800/80 hover:bg-gray-700 text-gray-300 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-gray-700/50 transition-all hover:scale-105 active:scale-95" title="Share Session"><Share2 size={16} /></button>
             <button onClick={saveToPresets} className="bg-gray-800/80 hover:bg-gray-700 text-gray-300 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-gray-700/50 transition-all hover:scale-105 active:scale-95" title="Save Preset"><Bookmark size={16} /></button>
             <button 
                onClick={handleExportAudio} 
                disabled={isRendering}
                className="bg-gray-800/80 hover:bg-gray-700 disabled:opacity-50 text-gray-300 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-gray-700/50 transition-all hover:scale-105 active:scale-95" 
                title="Render to WAV"
              >
                {isRendering ? <RefreshCw size={16} className="animate-spin" /> : <Music size={16} />}
              </button>
           </div>
           <button onClick={handleDownload} className="bg-accent-600 hover:bg-accent-500 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border border-accent-500 shadow-xl shadow-accent-900/20 transition-all text-[10px] sm:text-sm font-bold flex items-center gap-2 hover:scale-105 active:scale-95"><Save size={14} /><span className="hidden sm:inline">Export SBG</span></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-3 sm:p-6 gap-4 sm:gap-6 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
        {viewMode === ViewMode.STUDIO && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
               <div className="lg:col-span-4 space-y-4">
                  <Visualizer isPlaying={isPlaying} />
                  
                  <div className="bg-gray-900/80 rounded-2xl p-4 sm:p-6 border border-gray-800 shadow-2xl flex flex-col md:flex-row items-center gap-4 sm:gap-8 backdrop-blur-sm">
                     <button onClick={handlePlayToggle} className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex-none flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 ${isPlaying ? 'bg-red-500 hover:bg-red-600 shadow-red-900/40' : 'bg-green-500 hover:bg-green-600 shadow-green-900/40'} text-white shadow-2xl`}>
                        {isPlaying ? <Pause size={28} sm:size={36} fill="currentColor" /> : <Play size={28} sm:size={36} fill="currentColor" className="ml-1" />}
                     </button>
                     
                     <div className="flex-1 w-full md:w-auto px-0 sm:px-2">
                        <div className="flex justify-between text-[8px] sm:text-[10px] font-mono text-gray-500 mb-2 sm:mb-3 uppercase tracking-widest">
                           <span className="text-accent-500">{new Date(currentTime * 1000).toISOString().substr(14, 5)}</span>
                           <span className="text-gray-600">Sequence Progress</span>
                           <span>{new Date(totalDuration * 1000).toISOString().substr(14, 5)}</span>
                        </div>
                        <input type="range" min="0" max={totalDuration} value={currentTime} onChange={handleSeek} className="w-full h-1.5 sm:h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-accent-500" />
                     </div>
                     
                     <div className="flex-none grid grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-3 sm:gap-y-4 p-4 sm:p-5 bg-gray-950/40 rounded-xl sm:rounded-2xl border border-gray-800/50 w-full md:w-auto">
                        <div className="flex items-center gap-2 sm:gap-3 text-gray-500">
                           <Volume2 size={14} sm:size={16} />
                           <input type="range" min="0" max="100" value={volume} onChange={handleVolumeChange} className="flex-1 md:w-28 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-gray-400" />
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 text-gray-500">
                           <Sliders size={14} sm:size={16} />
                           <input type="range" min="200" max="8000" value={filterCutoff} onChange={handleFilterChange} className="flex-1 md:w-28 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-accent-600" />
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 text-gray-500">
                           <Wind size={14} sm:size={16} />
                           <input type="range" min="0" max="50" value={noiseLevel} onChange={handleNoiseChange} className="flex-1 md:w-28 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-gray-400" />
                        </div>
                        <div className="flex gap-1">
                            {[NoiseType.WHITE, NoiseType.PINK, NoiseType.BROWN].map(t => (
                              <button key={t} onClick={() => handleNoiseTypeChange(t)} className={`flex-1 text-[8px] sm:text-[9px] font-bold py-1 px-1.5 sm:px-2 rounded-md sm:rounded-lg transition-all ${noiseType === t ? 'bg-accent-600 text-white shadow-lg shadow-accent-900/20' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}>{t.charAt(0)}</button>
                            ))}
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-gray-900/90 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden flex flex-col relative backdrop-blur-sm min-h-[500px]">
               <div className="bg-gray-950 px-6 py-3 border-b border-gray-800 flex justify-between items-center">
                  <div className="flex bg-gray-900 rounded-lg p-1">
                     <button onClick={() => setStudioMode('timeline')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${studioMode === 'timeline' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>Timeline</button>
                     <button onClick={() => setStudioMode('script')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${studioMode === 'script' ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>Script</button>
                  </div>
                  <div className="flex items-center gap-4">
                     <SleepTimer isPlaying={isPlaying} onTimerEnd={handleTimerEnd} />
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        <span className="text-[8px] text-gray-700 font-mono">LIVE SYNC</span>
                     </div>
                  </div>
               </div>

               {studioMode === 'timeline' ? (
                 <div className="flex flex-col h-full animate-in fade-in duration-300">
                     <div className="w-full p-4 sm:p-8 flex-none border-b border-gray-800/50 bg-gray-900/30">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-6 sm:mb-8">
                           <div className="flex flex-wrap gap-4 sm:gap-6 w-full sm:w-auto">
                              <div className="p-4 sm:p-5 bg-gray-950/80 rounded-xl sm:rounded-2xl border border-gray-800 shadow-2xl flex-1 sm:min-w-[160px] group/val transition-all hover:border-accent-500/30">
                                 <span className="text-[8px] sm:text-[10px] text-gray-500 uppercase font-bold tracking-widest block mb-1 sm:mb-2">Entrainment Target</span>
                                 <span className="text-3xl sm:text-5xl font-mono font-bold text-accent-400 tabular-nums tracking-tighter leading-none group-hover/val:text-accent-300 transition-colors">
                                   {liveBeat.toFixed(2)}<span className="text-sm sm:text-base text-gray-600 ml-1 font-sans font-normal">Hz</span>
                                 </span>
                              </div>
                              <div className="p-4 sm:p-5 bg-gray-950/80 rounded-xl sm:rounded-2xl border border-gray-800 shadow-2xl flex-1 sm:min-w-[140px] transition-all hover:border-gray-700">
                                 <span className="text-[8px] sm:text-[10px] text-gray-500 uppercase font-bold tracking-widest block mb-1 sm:mb-2">Carrier Frequency</span>
                                 <span className="text-xl sm:text-3xl font-mono text-purple-400 tabular-nums leading-none">
                                   {liveCarrier.toFixed(0)}<span className="text-[10px] sm:text-xs text-gray-600 ml-1 font-sans font-normal">Hz</span>
                                 </span>
                              </div>
                           </div>
                           <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                              <button onClick={handleNewSequence} className="flex-1 sm:flex-none bg-gray-800/50 hover:bg-red-900/20 hover:text-red-400 text-gray-500 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold flex items-center justify-center gap-2 transition-all border border-gray-700/50 shadow-lg"><RefreshCw size={12} /> <span className="sm:inline">Reset</span></button>
                              <button onClick={handleAddEvent} className="flex-1 sm:flex-none bg-accent-600 hover:bg-accent-500 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-2xl shadow-accent-900/30 hover:scale-105 active:scale-95"><Plus size={16} /> <span className="sm:inline">Append Step</span></button>
                           </div>
                        </div>
                        <div className="relative pt-2">
                           <Timeline events={events} duration={totalDuration} onEventClick={setEditingEvent} onDeleteEvent={handleDeleteEvent} playbackTime={currentTime} />
                        </div>
                     </div>
                 </div>
               ) : (
                 <div className="flex flex-col h-full animate-in fade-in duration-300">
                    <textarea value={script} onChange={(e) => setScript(e.target.value)} className="flex-1 w-full bg-transparent text-gray-400 font-mono text-sm p-12 resize-none focus:outline-none focus:bg-gray-950/20 transition-all leading-loose custom-scrollbar" spellCheck={false} placeholder="Live script editor..." />
                 </div>
               )}
            </div>
          </div>
        )}

        {viewMode === ViewMode.AI_FORGE && (
          <div className="flex flex-col gap-4 sm:gap-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-3xl mx-auto w-full text-center space-y-3 sm:space-y-4 py-6 sm:py-12">
               <div className="inline-flex p-3 sm:p-4 bg-purple-500/10 rounded-2xl sm:rounded-3xl border border-purple-500/20 mb-2 sm:mb-4 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                  <Wand2 className="text-purple-400 w-8 h-8 sm:w-12 sm:h-12" />
               </div>
               <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">Neural Research Engine</h2>
               <p className="text-gray-400 text-sm sm:text-lg px-4">Harness Gemini 3.1 Pro to research scientific literature and forge optimal entrainment protocols.</p>
            </div>

            <div className="bg-gradient-to-r from-gray-900 via-gray-850 to-gray-900 rounded-2xl sm:rounded-3xl p-0.5 sm:p-1 border border-gray-700/30 shadow-2xl group relative overflow-hidden max-w-4xl mx-auto w-full">
               {isGenerating && (
                 <div className="absolute inset-0 bg-accent-400/5 animate-pulse pointer-events-none" />
               )}
               <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-3 sm:p-4 relative z-10">
                  <div className="flex-1 relative">
                     <input 
                        type="text" 
                        placeholder="e.g. 'Optimal frequencies for deep REM sleep...'" 
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-4 sm:py-5 text-gray-100 focus:ring-2 focus:ring-accent-400 outline-none text-sm sm:text-base placeholder-gray-600 font-mono transition-all pr-10 sm:pr-12 shadow-inner" 
                        value={aiPrompt} 
                        onChange={(e) => setAiPrompt(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()} 
                     />
                     <Search className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 text-gray-700 group-hover:text-accent-400 transition-colors w-5 h-5 sm:w-6 sm:h-6" size={24} />
                  </div>
                  <button 
                    onClick={handleAiGenerate} 
                    disabled={isGenerating || !aiPrompt.trim()} 
                    className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white px-6 sm:px-12 py-4 sm:py-5 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 sm:gap-3 transition-all shadow-2xl shadow-accent-900/40 hover:scale-[1.02] active:scale-[0.98] border border-accent-400/30"
                  >
                     {isGenerating ? <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : <Zap size={20} sm:size={24} />}
                     <span>{isGenerating ? 'Researching...' : 'Forge Protocol'}</span>
                  </button>
               </div>
               
               {sources.length > 0 && (
                 <div className="px-4 sm:px-8 py-4 sm:py-6 bg-gray-950/50 border-t border-gray-800/50 flex flex-col gap-3 sm:gap-4 animate-in slide-in-from-top-2 duration-300">
                    <span className="text-[10px] sm:text-xs text-gray-500 uppercase font-bold tracking-widest flex items-center gap-2">Scientific Grounding:</span>
                    <div className="flex flex-wrap gap-2 sm:gap-4">
                      {sources.map((s, idx) => (
                         <a key={idx} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-xs text-accent-500 hover:text-accent-400 font-mono flex items-center gap-1 sm:gap-1.5 transition-colors underline decoration-accent-500/30 bg-accent-500/5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg border border-accent-500/10">
                            <ExternalLink size={10} sm:size={12} /> {s.title}
                         </a>
                      ))}
                    </div>
                 </div>
               )}
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto w-full px-2">
               {[
                 { title: 'Scientific Accuracy', desc: 'Grounds every script in peer-reviewed research.', icon: Brain },
                 { title: 'SBaGen Native', desc: 'Generates clean scripts ready for playback.', icon: FileCode },
                 { title: 'Neural Optimization', desc: 'Calculates optimal carrier frequencies.', icon: Activity }
               ].map((feature, i) => (
                 <div key={i} className="bg-gray-900/50 p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-gray-800/50 text-center space-y-2 sm:space-y-3">
                    <feature.icon className="mx-auto text-gray-600" size={20} sm:size={24} />
                    <h4 className="text-xs sm:text-sm font-bold text-gray-300">{feature.title}</h4>
                    <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">{feature.desc}</p>
                 </div>
               ))}
            </div>
          </div>
        )}

        {viewMode === ViewMode.LIBRARY && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="lg:col-span-1 space-y-4 sm:space-y-6">
               <div className="bg-gray-900/80 rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-gray-800 shadow-xl flex flex-col gap-4 sm:gap-6 backdrop-blur-sm">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-3 sm:pb-4">
                     <h3 className="text-gray-400 uppercase tracking-widest text-[10px] sm:text-xs font-bold flex items-center gap-2"><Activity size={14}/> Standard Protocols</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:gap-3">
                     {STANDARD_PROTOCOLS.map(proto => (
                        <button key={proto.name} onClick={() => loadPreset(proto)} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-850/50 hover:bg-accent-950/30 rounded-xl sm:rounded-2xl border border-gray-800/50 text-left transition-all hover:border-accent-500/30 group">
                           <proto.icon size={18} sm:size={20} className="text-accent-500 group-hover:scale-110 transition-transform" />
                           <div className="flex-1">
                              <div className="text-xs sm:text-sm font-bold text-gray-200 group-hover:text-white">{proto.name}</div>
                              <div className="text-[8px] sm:text-[10px] text-gray-500 font-mono mt-0.5">Verified Neural Pattern</div>
                           </div>
                        </button>
                     ))}
                  </div>
               </div>
            </div>

            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
               <div className="bg-gray-900/80 rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-gray-800 shadow-xl flex flex-col gap-4 sm:gap-6 min-h-[400px] sm:min-h-[600px] backdrop-blur-sm">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-3 sm:pb-4">
                     <div className="flex items-center gap-3 sm:gap-4">
                        <h3 className="text-gray-400 uppercase tracking-widest text-[10px] sm:text-xs font-bold flex items-center gap-2"><Bookmark size={14}/> User Library</h3>
                        <div className="flex gap-2 sm:gap-3">
                           <label className="cursor-pointer text-gray-500 hover:text-accent-500 transition-colors" title="Import Library"><Upload size={14} /><input type="file" className="hidden" accept=".json" onChange={handleImportLibrary}/></label>
                           <button onClick={handleExportLibrary} className="text-gray-500 hover:text-accent-500 transition-colors" title="Export Library"><Save size={14} /></button>
                        </div>
                     </div>
                     <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-[8px] sm:text-[10px] text-gray-700 font-mono uppercase tracking-widest">{presets.length} Presets</span>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4 overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                     {presets.map(p => (
                        <div key={p.id} onClick={() => loadPreset(p)} className="group relative bg-gray-850/50 hover:bg-gray-800 p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-gray-800/50 cursor-pointer transition-all hover:border-accent-500/30 flex flex-col justify-between h-28 sm:h-32">
                           <div>
                              <div className="text-xs sm:text-sm font-bold text-gray-200 truncate pr-6 sm:pr-8">{p.name}</div>
                              <div className="text-[8px] sm:text-[10px] text-gray-600 font-mono mt-0.5 sm:mt-1">{new Date(p.date).toLocaleDateString()}</div>
                           </div>
                           <div className="flex justify-between items-center">
                              <div className="text-[8px] sm:text-[9px] text-accent-500/50 font-mono uppercase tracking-widest">SBaGen Native</div>
                              <button onClick={(e) => deletePreset(p.id, e)} className="p-1.5 sm:p-2 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all bg-gray-900 rounded-lg"><Trash2 size={12} sm:size={14} /></button>
                           </div>
                        </div>
                     ))}
                     {presets.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-16 sm:py-32 border-2 border-dashed border-gray-800/50 rounded-2xl sm:rounded-3xl opacity-40">
                           <Bookmark size={32} sm:size={48} className="mb-2 sm:mb-4 text-gray-700" />
                           <p className="text-[10px] sm:text-sm font-mono uppercase tracking-widest">Library Empty</p>
                        </div>
                     )}
                  </div>
               </div>
            </div>
          </div>
        )}
      </main>

      <footer className="p-4 sm:p-6 border-t border-gray-900/50 bg-gray-950 flex flex-col sm:flex-row items-center justify-between gap-4 sm:px-12 transition-all opacity-80 hover:opacity-100">
         <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex flex-col">
               <p className="text-[8px] sm:text-[10px] text-gray-600 font-mono uppercase tracking-[0.4em] font-bold">Forge Core Active</p>
               <p className="text-[7px] sm:text-[8px] text-gray-800 font-mono mt-0.5 sm:mt-1">LATENCY: LOW | SAMPLE RATE: 44.1kHz</p>
            </div>
            <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.6)]' : 'bg-gray-800'}`} />
         </div>
         <div className="flex gap-6 sm:gap-10 text-[8px] sm:text-[9px] text-gray-700 font-mono uppercase tracking-widest font-bold">
            <span className="hover:text-accent-500 cursor-help transition-all border-b border-transparent hover:border-accent-500 pb-0.5 sm:pb-1">Docs</span>
            <span className="hover:text-accent-500 cursor-help transition-all border-b border-transparent hover:border-accent-500 pb-0.5 sm:pb-1">API</span>
            <span className="hover:text-accent-500 cursor-help transition-all border-b border-transparent hover:border-accent-500 pb-0.5 sm:pb-1">GitHub</span>
         </div>
      </footer>

      <EventEditor event={editingEvent} onSave={handleEventUpdate} onCancel={() => setEditingEvent(null)} />
    </div>
  );
}

export default App;
