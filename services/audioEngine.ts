import { BeatEvent, NoiseType } from '../types';

class BinauralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  private oscLeft: OscillatorNode | null = null;
  private oscRight: OscillatorNode | null = null;
  private pannerLeft: StereoPannerNode | null = null;
  private pannerRight: StereoPannerNode | null = null;

  private noiseNode: ScriptProcessorNode | null = null;
  private noiseGain: GainNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private currentNoiseType: NoiseType = NoiseType.PINK;

  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  private breathingMod: GainNode | null = null;

  public analyserLeft: AnalyserNode | null = null;
  public analyserRight: AnalyserNode | null = null;

  private isRunning: boolean = false;
  private events: BeatEvent[] = [];
  private playbackStartTime: number = 0;
  private pausedAt: number = 0;
  private masterVolume: number = 0.5;
  private noiseLevel: number = 0.15;
  private filterCutoff: number = 2000;

  constructor() {}

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = this.masterVolume;

    this.breathingMod = this.ctx.createGain();
    this.breathingMod.gain.value = 1.0;
    this.breathingMod.connect(this.masterGain);

    this.analyserLeft = this.ctx.createAnalyser();
    this.analyserRight = this.ctx.createAnalyser();
    this.analyserLeft.fftSize = 1024;
    this.analyserRight.fftSize = 1024;

    this.setupNoise();
    this.setupLFO();
  }

  private setupLFO() {
    if (!this.ctx || !this.breathingMod) return;
    this.lfo = this.ctx.createOscillator();
    this.lfoGain = this.ctx.createGain();
    this.lfo.frequency.value = 0.08; 
    this.lfoGain.gain.value = 0.03;
    this.lfo.connect(this.lfoGain);
    this.lfo.start();
  }

  private setupNoise() {
    if (!this.ctx || !this.breathingMod) return;

    const bufferSize = 4096;
    let b0, b1, b2, b3, b4, b5, b6;
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
    let lastOut = 0.0;

    const node = this.ctx.createScriptProcessor(bufferSize, 1, 1);
    node.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        
        if (this.currentNoiseType === NoiseType.WHITE) {
          output[i] = white * 0.1;
        } else if (this.currentNoiseType === NoiseType.PINK) {
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          output[i] *= 0.11;
          b6 = white * 0.115926;
        } else if (this.currentNoiseType === NoiseType.BROWN) {
          output[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        } else {
          output[i] = 0;
        }
      }
    };

    this.noiseFilter = this.ctx.createBiquadFilter();
    this.noiseFilter.type = 'lowpass';
    this.noiseFilter.frequency.value = this.filterCutoff;
    this.noiseFilter.Q.value = 1.0;

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = this.currentNoiseType === NoiseType.OFF ? 0 : this.noiseLevel;
    
    node.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.breathingMod);
    this.noiseNode = node;
  }

  setNoiseType(type: NoiseType) {
    this.currentNoiseType = type;
    if (this.noiseGain && this.ctx) {
      const target = type === NoiseType.OFF ? 0 : this.noiseLevel;
      this.noiseGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    }
  }

  setFilterCutoff(hz: number) {
    this.filterCutoff = hz;
    if (this.noiseFilter && this.ctx) {
      this.noiseFilter.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.1);
    }
  }

  setMasterVolume(percent: number) {
    this.masterVolume = Math.max(0, Math.min(1, percent / 100));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  setNoiseLevel(percent: number) {
    this.noiseLevel = Math.max(0, Math.min(1, percent / 100));
    if (this.noiseGain && this.ctx && this.currentNoiseType !== NoiseType.OFF) {
      this.noiseGain.gain.setTargetAtTime(this.noiseLevel, this.ctx.currentTime, 0.1);
    }
  }

  setBreathingIntensity(intensity: number) {
    // Subtle ducking of the whole mix (0.0 to 1.0 intensity)
    if (this.breathingMod && this.ctx) {
      const target = 1.0 - (intensity * 0.15); // max 15% ducking
      this.breathingMod.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    }
  }

  private clearOscillators() {
    [this.oscLeft, this.oscRight].forEach(osc => {
      if (osc) {
        try { osc.stop(); } catch(e) {}
        osc.disconnect();
      }
    });
    this.oscLeft = null;
    this.oscRight = null;
  }

  private createOscillators(startTime: number) {
    if (!this.ctx || !this.breathingMod) return;
    this.clearOscillators();

    this.oscLeft = this.ctx.createOscillator();
    this.pannerLeft = this.ctx.createStereoPanner();
    this.pannerLeft.pan.value = -1;

    this.oscRight = this.ctx.createOscillator();
    this.pannerRight = this.ctx.createStereoPanner();
    this.pannerRight.pan.value = 1;

    this.oscLeft.connect(this.pannerLeft);
    if(this.analyserLeft) this.pannerLeft.connect(this.analyserLeft);
    this.pannerLeft.connect(this.breathingMod);

    this.oscRight.connect(this.pannerRight);
    if(this.analyserRight) this.pannerRight.connect(this.analyserRight);
    this.pannerRight.connect(this.breathingMod);

    const now = this.ctx.currentTime;
    
    this.events.forEach((evt) => {
      const evtTime = now + (evt.timeOffset - startTime);
      const leftFreq = evt.carrierFreq - (evt.beatFreq / 2);
      const rightFreq = evt.carrierFreq + (evt.beatFreq / 2);

      if (evtTime <= now) {
        this.oscLeft?.frequency.setValueAtTime(leftFreq, now);
        this.oscRight?.frequency.setValueAtTime(rightFreq, now);
      } else {
        this.oscLeft?.frequency.linearRampToValueAtTime(leftFreq, evtTime);
        this.oscRight?.frequency.linearRampToValueAtTime(rightFreq, evtTime);
      }
    });

    this.oscLeft.start(now);
    this.oscRight.start(now);
  }

  loadEvents(events: BeatEvent[]) {
    this.events = [...events].sort((a, b) => a.timeOffset - b.timeOffset);
    if (this.isRunning) {
      this.createOscillators(this.getCurrentTime());
    }
  }

  play(offset: number = 0) {
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') this.ctx.resume();

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.1);
    }

    this.pausedAt = offset;
    this.createOscillators(offset);
    this.isRunning = true;
    this.playbackStartTime = this.ctx!.currentTime - offset;
  }

  stop() {
    this.clearOscillators();
    this.isRunning = false;
  }

  fadeOutAndStop(duration: number = 5) {
    if (!this.ctx || !this.masterGain) {
      this.stop();
      return;
    }
    const now = this.ctx.currentTime;
    this.masterGain.gain.linearRampToValueAtTime(0, now + duration);
    setTimeout(() => {
      if (this.isRunning) this.stop();
    }, duration * 1000 + 100);
  }

  getCurrentTime(): number {
    if (!this.isRunning || !this.ctx) return this.pausedAt;
    return this.ctx.currentTime - this.playbackStartTime;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  async renderToWav(events: BeatEvent[], duration: number, options: {
    volume: number,
    noiseLevel: number,
    noiseType: NoiseType,
    filterCutoff: number
  }): Promise<Blob> {
    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
    
    const masterGain = offlineCtx.createGain();
    masterGain.connect(offlineCtx.destination);
    masterGain.gain.value = options.volume / 100;

    // Oscillators
    const oscLeft = offlineCtx.createOscillator();
    const pannerLeft = offlineCtx.createStereoPanner();
    pannerLeft.pan.value = -1;
    oscLeft.connect(pannerLeft);
    pannerLeft.connect(masterGain);

    const oscRight = offlineCtx.createOscillator();
    const pannerRight = offlineCtx.createStereoPanner();
    pannerRight.pan.value = 1;
    oscRight.connect(pannerRight);
    pannerRight.connect(masterGain);

    events.forEach((evt) => {
      const evtTime = evt.timeOffset;
      if (evtTime >= duration) return;
      
      const leftFreq = evt.carrierFreq - (evt.beatFreq / 2);
      const rightFreq = evt.carrierFreq + (evt.beatFreq / 2);

      if (evtTime <= 0) {
        oscLeft.frequency.setValueAtTime(leftFreq, 0);
        oscRight.frequency.setValueAtTime(rightFreq, 0);
      } else {
        oscLeft.frequency.linearRampToValueAtTime(leftFreq, evtTime);
        oscRight.frequency.linearRampToValueAtTime(rightFreq, evtTime);
      }
    });

    // Noise (using a BufferSource for offline rendering instead of ScriptProcessor for better compatibility)
    if (options.noiseType !== NoiseType.OFF && options.noiseLevel > 0) {
      const noiseBuffer = offlineCtx.createBuffer(1, sampleRate * duration, sampleRate);
      const output = noiseBuffer.getChannelData(0);
      
      let b0, b1, b2, b3, b4, b5, b6;
      b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
      let lastOut = 0.0;

      for (let i = 0; i < sampleRate * duration; i++) {
        const white = Math.random() * 2 - 1;
        if (options.noiseType === NoiseType.WHITE) {
          output[i] = white * 0.1;
        } else if (options.noiseType === NoiseType.PINK) {
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        } else if (options.noiseType === NoiseType.BROWN) {
          output[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        }
      }

      const noiseSource = offlineCtx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      
      const noiseFilter = offlineCtx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = options.filterCutoff;
      
      const noiseGain = offlineCtx.createGain();
      noiseGain.gain.value = options.noiseLevel / 100;

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGain);
      noiseSource.start(0);
    }

    oscLeft.start(0);
    oscRight.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    return this.bufferToWav(renderedBuffer);
  }

  private bufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i, sample, offset = 0, pos = 0;

    // write WAVE header
    const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
    const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // write interleaved data
    for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

    while (pos < length) {
      for (i = 0; i < numOfChan; i++) { // interleave channels
        sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
        view.setInt16(pos, sample, true); // write 16-bit sample
        pos += 2;
      }
      offset++; // next source sample
    }

    return new Blob([bufferArr], { type: 'audio/wav' });
  }
}

export const audioEngine = new BinauralAudioEngine();
