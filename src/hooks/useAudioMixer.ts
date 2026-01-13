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
  dryGain: GainNode;
  reverbSend: GainNode;
  convolver: ConvolverNode;
  wetGain: GainNode;
  lowpass: BiquadFilterNode;
  output: GainNode;
  autoPanOsc: OscillatorNode | null;
  autoPanGain: GainNode | null;
}

function createEffectChain(ctx: AudioContext, impulseBuffer: AudioBuffer): EffectChain {
  const input = ctx.createGain();
  const panner = ctx.createStereoPanner();
  const dryGain = ctx.createGain();
  const reverbSend = ctx.createGain();
  const convolver = ctx.createConvolver();
  convolver.buffer = impulseBuffer;
  const wetGain = ctx.createGain();
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.Q.value = 0.7;
  const output = ctx.createGain();

  // Routing: input -> panner -> (dry + reverb send) -> lowpass -> output
  input.connect(panner);
  panner.connect(dryGain);
  dryGain.connect(lowpass);
  
  panner.connect(reverbSend);
  reverbSend.connect(convolver);
  convolver.connect(wetGain);
  wetGain.connect(lowpass);
  
  lowpass.connect(output);

  return {
    input,
    panner,
    dryGain,
    reverbSend,
    convolver,
    wetGain,
    lowpass,
    output,
    autoPanOsc: null,
    autoPanGain: null,
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
}

export function useAudioMixer(
  masterVolume: number,
  noiseVolume: number,
  ambienceVolume: number,
  effects: EffectsSettings
) {
  const ctxRef = useRef<AudioContext | null>(null);
  const impulseBufferRef = useRef<AudioBuffer | null>(null);

  // Per-target effect chains
  const songChainRef = useRef<EffectChain | null>(null);
  const noiseChainRef = useRef<EffectChain | null>(null);
  const ambienceChainRef = useRef<EffectChain | null>(null);

  // Master output
  const masterOutRef = useRef<GainNode | null>(null);

  const wiredRef = useRef(false);

  const paramsRef = useRef({ masterVolume, noiseVolume, ambienceVolume, effects });
  useEffect(() => {
    paramsRef.current = { masterVolume, noiseVolume, ambienceVolume, effects };
  }, [masterVolume, noiseVolume, ambienceVolume, effects]);

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
  }, []);

  const init = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = ctxRef.current;

    // Create impulse buffer once
    if (!impulseBufferRef.current) {
      impulseBufferRef.current = createHallImpulse(ctx);
    }

    // Create master output
    if (!masterOutRef.current) {
      masterOutRef.current = ctx.createGain();
      masterOutRef.current.connect(ctx.destination);
    }

    // Create effect chains for each target
    if (!songChainRef.current) {
      songChainRef.current = createEffectChain(ctx, impulseBufferRef.current);
    }
    if (!noiseChainRef.current) {
      noiseChainRef.current = createEffectChain(ctx, impulseBufferRef.current);
    }
    if (!ambienceChainRef.current) {
      ambienceChainRef.current = createEffectChain(ctx, impulseBufferRef.current);
    }

    // Wire chains to master output
    if (!wiredRef.current) {
      songChainRef.current.output.connect(masterOutRef.current);
      noiseChainRef.current.output.connect(masterOutRef.current);
      ambienceChainRef.current.output.connect(masterOutRef.current);
      wiredRef.current = true;
    }

    applyVolumesAndFx();

    return ctx;
  }, [applyVolumesAndFx]);

  const ensure = useCallback(() => {
    const ctx = init();
    void resumeAudioContext(ctx, "mixer");
    return ctx;
  }, [init]);

  const getToneInput = useCallback(() => {
    ensure();
    return songChainRef.current!.input;
  }, [ensure]);

  const getNoiseInput = useCallback(() => {
    ensure();
    return noiseChainRef.current!.input;
  }, [ensure]);

  const getAmbienceInput = useCallback(() => {
    ensure();
    return ambienceChainRef.current!.input;
  }, [ensure]);

  // If context exists, keep params applied live
  useEffect(() => {
    if (!ctxRef.current) return;
    applyVolumesAndFx();
  }, [applyVolumesAndFx, masterVolume, noiseVolume, ambienceVolume, effects]);

  // Kill all sound immediately (including reverb tail)
  const killAll = useCallback(() => {
    if (!ctxRef.current) return;
    const ctx = ctxRef.current;

    // Zero out all chain inputs immediately
    songChainRef.current?.input.gain.setValueAtTime(0, ctx.currentTime);
    noiseChainRef.current?.input.gain.setValueAtTime(0, ctx.currentTime);
    ambienceChainRef.current?.input.gain.setValueAtTime(0, ctx.currentTime);

    // Zero out reverb wet signals to kill tails
    songChainRef.current?.wetGain.gain.setValueAtTime(0, ctx.currentTime);
    noiseChainRef.current?.wetGain.gain.setValueAtTime(0, ctx.currentTime);
    ambienceChainRef.current?.wetGain.gain.setValueAtTime(0, ctx.currentTime);

    // Stop autopan oscillators
    [songChainRef, noiseChainRef, ambienceChainRef].forEach((chainRef) => {
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
    });
  }, []);

  // Restore volumes after killAll
  const restore = useCallback(() => {
    applyVolumesAndFx();
  }, [applyVolumesAndFx]);

  return {
    ensure,
    getToneInput,
    getNoiseInput,
    getAmbienceInput,
    killAll,
    restore,
  };
}
