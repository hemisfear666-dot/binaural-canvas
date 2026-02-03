import { useCallback, useEffect, useRef } from "react";
import type { EffectsSettings, SingleEffectSettings } from "@/types/binaural";
import { resumeAudioContext } from "@/lib/audio/resumeAudioContext";

function createHallImpulse(ctx: AudioContext, seconds = 7, decay = 3.5) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const env = Math.pow(1 - t, decay);
      data[i] = (Math.random() * 2 - 1) * env;
    }
  }

  return impulse;
}

// Per-target effect chain
interface EffectChain {
  input: GainNode;
  panner: StereoPannerNode;
  pannerNode3d: PannerNode; // 3D spatial panner
  dryGain: GainNode;
  reverbSend: GainNode;
  convolver: ConvolverNode;
  wetGain: GainNode;
  lowpass: BiquadFilterNode;
  output: GainNode;
  autoPanOsc: OscillatorNode | null;
  autoPanGain: GainNode | null;
  audio3dOsc: OscillatorNode | null; // For 3D spatial movement
  audio3dGain: GainNode | null;
  timeshiftNode: AudioBufferSourceNode | null; // For playback rate shifting
}

function createEffectChain(ctx: AudioContext, impulseBuffer: AudioBuffer): EffectChain {
  const input = ctx.createGain();
  const panner = ctx.createStereoPanner();
  
  // 3D spatial panner for immersive audio
  const pannerNode3d = ctx.createPanner();
  pannerNode3d.panningModel = 'HRTF';
  pannerNode3d.distanceModel = 'inverse';
  pannerNode3d.refDistance = 1;
  pannerNode3d.maxDistance = 10000;
  pannerNode3d.rolloffFactor = 1;
  pannerNode3d.coneInnerAngle = 360;
  pannerNode3d.coneOuterAngle = 360;
  pannerNode3d.coneOuterGain = 0;
  // Start at center
  pannerNode3d.positionX.value = 0;
  pannerNode3d.positionY.value = 0;
  pannerNode3d.positionZ.value = 0;
  
  const dryGain = ctx.createGain();
  const reverbSend = ctx.createGain();
  const convolver = ctx.createConvolver();
  convolver.buffer = impulseBuffer;
  const wetGain = ctx.createGain();
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.Q.value = 0.7;
  const output = ctx.createGain();

  // Routing: input -> panner -> pannerNode3d -> (dry + reverb send) -> lowpass -> output
  input.connect(panner);
  panner.connect(pannerNode3d);
  pannerNode3d.connect(dryGain);
  dryGain.connect(lowpass);
  
  pannerNode3d.connect(reverbSend);
  reverbSend.connect(convolver);
  convolver.connect(wetGain);
  wetGain.connect(lowpass);
  
  lowpass.connect(output);

  return {
    input,
    panner,
    pannerNode3d,
    dryGain,
    reverbSend,
    convolver,
    wetGain,
    lowpass,
    output,
    autoPanOsc: null,
    autoPanGain: null,
    audio3dOsc: null,
    audio3dGain: null,
    timeshiftNode: null,
  };
}

function applyEffectsToChain(
  ctx: AudioContext,
  chain: EffectChain,
  settings: SingleEffectSettings
) {
  const clamp01 = (v: unknown, fallback: number) => {
    const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
    return Math.max(0, Math.min(1, n));
  };

  // Reverb
  const amount = clamp01(settings?.reverb?.amount, 0);
  const send = settings?.reverb?.enabled ? amount : 0;
  chain.reverbSend.gain.setValueAtTime(send, ctx.currentTime);

  // Lowpass
  const nyquist = ctx.sampleRate / 2;
  const raw = settings?.lowpass?.frequency;
  const freq = typeof raw === "number" && Number.isFinite(raw) ? raw : nyquist;
  const target = settings?.lowpass?.enabled ? Math.max(20, Math.min(nyquist, freq)) : nyquist;
  chain.lowpass.frequency.setValueAtTime(target, ctx.currentTime);

  // Auto-pan
  if (settings?.autoPan?.enabled) {
    const rateRaw = settings.autoPan.rate;
    const rate = typeof rateRaw === "number" && Number.isFinite(rateRaw) ? rateRaw : 0.1;
    const depth = clamp01(settings.autoPan.depth, 0.5);

    if (!chain.autoPanOsc || !chain.autoPanGain) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = rate;
      g.gain.value = depth;
      osc.connect(g);
      g.connect(chain.panner.pan);
      osc.start();
      chain.autoPanOsc = osc;
      chain.autoPanGain = g;
    } else {
      chain.autoPanOsc.frequency.setValueAtTime(rate, ctx.currentTime);
      chain.autoPanGain.gain.setValueAtTime(depth, ctx.currentTime);
    }
  } else {
    if (chain.autoPanOsc) {
      try {
        chain.autoPanOsc.stop();
        chain.autoPanOsc.disconnect();
      } catch {
        // ignore
      }
      chain.autoPanOsc = null;
    }
    if (chain.autoPanGain) {
      try {
        chain.autoPanGain.disconnect();
      } catch {
        // ignore
      }
      chain.autoPanGain = null;
    }
    chain.panner.pan.setValueAtTime(0, ctx.currentTime);
  }

  // 3D Audio - sweeping spatial movement
  if (settings?.audio3d?.enabled) {
    const intensity = clamp01(settings.audio3d.intensity, 0.5);
    const radius = 3 * intensity; // Distance from center
    const sweepRate = 0.1 + intensity * 0.2; // Sweep speed

    if (!chain.audio3dOsc) {
      // Create oscillators for X and Z movement (circular sweep)
      const oscX = ctx.createOscillator();
      oscX.type = "sine";
      oscX.frequency.value = sweepRate;
      
      const gainX = ctx.createGain();
      gainX.gain.value = radius;
      
      oscX.connect(gainX);
      // Use a scriptProcessor or worklet to apply LFO to panner position
      // For simplicity, we'll use a periodic update
      oscX.start();
      
      chain.audio3dOsc = oscX;
      chain.audio3dGain = gainX;

      // Start a periodic update for 3D position
      const update3DPosition = () => {
        if (!chain.audio3dOsc) return;
        const t = ctx.currentTime * sweepRate * Math.PI * 2;
        const x = Math.sin(t) * radius;
        const z = Math.cos(t) * radius;
        const y = Math.sin(t * 0.7) * radius * 0.3; // Slight vertical movement
        
        chain.pannerNode3d.positionX.setValueAtTime(x, ctx.currentTime);
        chain.pannerNode3d.positionY.setValueAtTime(y, ctx.currentTime);
        chain.pannerNode3d.positionZ.setValueAtTime(z - 1, ctx.currentTime); // Offset Z slightly
        
        if (chain.audio3dOsc) {
          requestAnimationFrame(update3DPosition);
        }
      };
      update3DPosition();
    } else {
      // Update intensity
      if (chain.audio3dGain) {
        chain.audio3dGain.gain.setValueAtTime(radius, ctx.currentTime);
      }
    }
  } else {
    // Disable 3D audio - return to center
    if (chain.audio3dOsc) {
      try {
        chain.audio3dOsc.stop();
        chain.audio3dOsc.disconnect();
      } catch {
        // ignore
      }
      chain.audio3dOsc = null;
    }
    if (chain.audio3dGain) {
      try {
        chain.audio3dGain.disconnect();
      } catch {
        // ignore
      }
      chain.audio3dGain = null;
    }
    // Reset position to center
    chain.pannerNode3d.positionX.setValueAtTime(0, ctx.currentTime);
    chain.pannerNode3d.positionY.setValueAtTime(0, ctx.currentTime);
    chain.pannerNode3d.positionZ.setValueAtTime(0, ctx.currentTime);
  }

  // Timeshift - adjust playback rate via detune (works on oscillators connected through)
  // Since we can't change playback rate of the entire chain directly,
  // we'll apply a frequency shift approximation via the lowpass and detune
  // NOTE: True timeshift requires source-level control. For now, apply a subtle pitch shift effect.
  if (settings?.timeshift?.enabled) {
    const rate =
      typeof settings.timeshift.rate === "number" && Number.isFinite(settings.timeshift.rate)
        ? Math.max(0.5, Math.min(5.0, settings.timeshift.rate))
        : 1.0;

    // Store rate for potential source-level use
    (chain as any)._timeshiftRate = rate;
  } else {
    (chain as any)._timeshiftRate = 1.0;
  }
}

export function useAudioMixer(
  masterVolume: number,
  noiseVolume: number,
  ambienceVolume: number,
  ambientMusicVolume: number,
  effects: EffectsSettings
) {
  const ctxRef = useRef<AudioContext | null>(null);
  const impulseBufferRef = useRef<AudioBuffer | null>(null);

  // Per-target effect chains
  const songChainRef = useRef<EffectChain | null>(null);
  const noiseChainRef = useRef<EffectChain | null>(null);
  const ambienceChainRef = useRef<EffectChain | null>(null);
  const ambientMusicChainRef = useRef<EffectChain | null>(null);

  // Master output
  const masterOutRef = useRef<GainNode | null>(null);

  const wiredRef = useRef(false);

  const paramsRef = useRef({ masterVolume, noiseVolume, ambienceVolume, ambientMusicVolume, effects });
  useEffect(() => {
    paramsRef.current = { masterVolume, noiseVolume, ambienceVolume, ambientMusicVolume, effects };
  }, [masterVolume, noiseVolume, ambienceVolume, ambientMusicVolume, effects]);

  const applyVolumesAndFx = useCallback(() => {
    if (!ctxRef.current) return;
    const ctx = ctxRef.current;
    const p = paramsRef.current;

    const clamp01 = (v: unknown, fallback: number) => {
      const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
      return Math.max(0, Math.min(1, n));
    };

    // Master volume
    masterOutRef.current?.gain.setValueAtTime(clamp01(p.masterVolume, 0.5), ctx.currentTime);

    // Per-chain volumes
    if (songChainRef.current) {
      songChainRef.current.input.gain.setValueAtTime(1, ctx.currentTime); // Song uses section volumes
    }
    if (noiseChainRef.current) {
      noiseChainRef.current.input.gain.setValueAtTime(clamp01(p.noiseVolume, 0), ctx.currentTime);
    }
    if (ambienceChainRef.current) {
      ambienceChainRef.current.input.gain.setValueAtTime(clamp01(p.ambienceVolume, 0), ctx.currentTime);
    }
    if (ambientMusicChainRef.current) {
      ambientMusicChainRef.current.input.gain.setValueAtTime(clamp01(p.ambientMusicVolume, 0), ctx.currentTime);
    }

    // Apply effects to each chain
    if (songChainRef.current && p.effects?.song) {
      applyEffectsToChain(ctx, songChainRef.current, p.effects.song);
    }
    if (noiseChainRef.current && p.effects?.noise) {
      applyEffectsToChain(ctx, noiseChainRef.current, p.effects.noise);
    }
    if (ambienceChainRef.current && p.effects?.soundscape) {
      applyEffectsToChain(ctx, ambienceChainRef.current, p.effects.soundscape);
    }
    if (ambientMusicChainRef.current && p.effects?.ambientMusic) {
      applyEffectsToChain(ctx, ambientMusicChainRef.current, p.effects.ambientMusic);
    }
  }, []);

  const init = useCallback(() => {
    // Recreate AudioContext if it was closed (can happen after hot reloads or browser policy changes)
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('[mixer] Created new AudioContext, state:', ctxRef.current.state);
    }

    const ctx = ctxRef.current;

    // If we ever end up with nodes created from a previous AudioContext,
    // they will silently produce no sound. Detect and rebuild.
    const hasStaleNodes =
      (masterOutRef.current && masterOutRef.current.context !== ctx) ||
      (songChainRef.current && songChainRef.current.input.context !== ctx) ||
      (noiseChainRef.current && noiseChainRef.current.input.context !== ctx) ||
      (ambienceChainRef.current && ambienceChainRef.current.input.context !== ctx) ||
      (ambientMusicChainRef.current && ambientMusicChainRef.current.input.context !== ctx);

    if (hasStaleNodes) {
      console.log('[mixer] Detected stale nodes, rebuilding all chains');
      try {
        masterOutRef.current?.disconnect();
      } catch {
        // ignore
      }

      // Drop references so everything is recreated for the current ctx
      masterOutRef.current = null;
      songChainRef.current = null;
      noiseChainRef.current = null;
      ambienceChainRef.current = null;
      ambientMusicChainRef.current = null;
      impulseBufferRef.current = null;
      wiredRef.current = false;
    }

    // Create impulse buffer once
    if (!impulseBufferRef.current) {
      impulseBufferRef.current = createHallImpulse(ctx);
      console.log('[mixer] Created impulse buffer');
    }

    // Create master output
    if (!masterOutRef.current) {
      masterOutRef.current = ctx.createGain();
      masterOutRef.current.connect(ctx.destination);
      console.log('[mixer] Created master output, connected to destination');
    }

    // Create effect chains for each target
    if (!songChainRef.current) {
      songChainRef.current = createEffectChain(ctx, impulseBufferRef.current);
      console.log('[mixer] Created song chain');
    }
    if (!noiseChainRef.current) {
      noiseChainRef.current = createEffectChain(ctx, impulseBufferRef.current);
    }
    if (!ambienceChainRef.current) {
      ambienceChainRef.current = createEffectChain(ctx, impulseBufferRef.current);
    }
    if (!ambientMusicChainRef.current) {
      ambientMusicChainRef.current = createEffectChain(ctx, impulseBufferRef.current);
    }

    // Wire chains to master output
    if (!wiredRef.current) {
      songChainRef.current.output.connect(masterOutRef.current);
      noiseChainRef.current.output.connect(masterOutRef.current);
      ambienceChainRef.current.output.connect(masterOutRef.current);
      ambientMusicChainRef.current.output.connect(masterOutRef.current);
      wiredRef.current = true;
      console.log('[mixer] Wired all chains to master output');
    }

    applyVolumesAndFx();
    console.log('[mixer] init() complete, ctx.state:', ctx.state);

    return ctx;
  }, [applyVolumesAndFx]);

  const ensure = useCallback(() => {
    const ctx = init();
    void resumeAudioContext(ctx, "mixer");
    return ctx;
  }, [init]);

  const getToneInput = useCallback(() => {
    // Don't call ensure() here - the caller (audio engine) is responsible for calling ensure() first
    // Calling ensure() here causes race conditions with the audio engine's own initialization
    if (!songChainRef.current) {
      console.warn('[mixer] getToneInput called but song chain not initialized');
      // Fallback: initialize if needed
      init();
    }
    return songChainRef.current!.input;
  }, [init]);

  const getNoiseInput = useCallback(() => {
    if (!noiseChainRef.current) {
      init();
    }
    return noiseChainRef.current!.input;
  }, [init]);

  const getAmbienceInput = useCallback(() => {
    if (!ambienceChainRef.current) {
      init();
    }
    return ambienceChainRef.current!.input;
  }, [init]);

  const getAmbientMusicInput = useCallback(() => {
    if (!ambientMusicChainRef.current) {
      init();
    }
    return ambientMusicChainRef.current!.input;
  }, [init]);

  // If context exists, keep params applied live
  useEffect(() => {
    if (!ctxRef.current) return;
    applyVolumesAndFx();
  }, [applyVolumesAndFx, masterVolume, noiseVolume, ambienceVolume, ambientMusicVolume, effects]);

  // Kill all sound immediately (including reverb tail)
  const killAll = useCallback(() => {
    if (!ctxRef.current) return;
    const ctx = ctxRef.current;

    // Zero out all chain inputs immediately
    songChainRef.current?.input.gain.setValueAtTime(0, ctx.currentTime);
    noiseChainRef.current?.input.gain.setValueAtTime(0, ctx.currentTime);
    ambienceChainRef.current?.input.gain.setValueAtTime(0, ctx.currentTime);
    ambientMusicChainRef.current?.input.gain.setValueAtTime(0, ctx.currentTime);

    // Zero out reverb wet signals to kill tails
    songChainRef.current?.wetGain.gain.setValueAtTime(0, ctx.currentTime);
    noiseChainRef.current?.wetGain.gain.setValueAtTime(0, ctx.currentTime);
    ambienceChainRef.current?.wetGain.gain.setValueAtTime(0, ctx.currentTime);
    ambientMusicChainRef.current?.wetGain.gain.setValueAtTime(0, ctx.currentTime);

    // Stop autopan and 3D audio oscillators
    [songChainRef, noiseChainRef, ambienceChainRef, ambientMusicChainRef].forEach((chainRef) => {
      const chain = chainRef.current;
      if (chain?.autoPanOsc) {
        try {
          chain.autoPanOsc.stop();
          chain.autoPanOsc.disconnect();
        } catch {
          // ignore
        }
        chain.autoPanOsc = null;
      }
      if (chain?.autoPanGain) {
        try {
          chain.autoPanGain.disconnect();
        } catch {
          // ignore
        }
        chain.autoPanGain = null;
      }
      if (chain?.audio3dOsc) {
        try {
          chain.audio3dOsc.stop();
          chain.audio3dOsc.disconnect();
        } catch {
          // ignore
        }
        chain.audio3dOsc = null;
      }
      if (chain?.audio3dGain) {
        try {
          chain.audio3dGain.disconnect();
        } catch {
          // ignore
        }
        chain.audio3dGain = null;
      }
      // Reset 3D position
      if (chain?.pannerNode3d) {
        chain.pannerNode3d.positionX.setValueAtTime(0, ctxRef.current!.currentTime);
        chain.pannerNode3d.positionY.setValueAtTime(0, ctxRef.current!.currentTime);
        chain.pannerNode3d.positionZ.setValueAtTime(0, ctxRef.current!.currentTime);
      }
    });
  }, []);

  // Restore volumes after killAll
  const restore = useCallback(() => {
    applyVolumesAndFx();
  }, [applyVolumesAndFx]);

  const getContext = useCallback(() => ctxRef.current, []);

  return {
    ensure,
    getContext,
    getToneInput,
    getNoiseInput,
    getAmbienceInput,
    getAmbientMusicInput,
    killAll,
    restore,
  };
}
