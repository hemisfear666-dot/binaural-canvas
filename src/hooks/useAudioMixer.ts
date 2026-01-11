import { useCallback, useEffect, useRef } from "react";
import type { EffectsSettings } from "@/types/binaural";
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

export function useAudioMixer(
  masterVolume: number,
  noiseVolume: number,
  ambienceVolume: number,
  effects: EffectsSettings
) {
  const ctxRef = useRef<AudioContext | null>(null);

  const toneBusRef = useRef<GainNode | null>(null);
  const noiseBusRef = useRef<GainNode | null>(null);
  const ambienceBusRef = useRef<GainNode | null>(null);

  const noisePannerRef = useRef<StereoPannerNode | null>(null);

  const sumRef = useRef<GainNode | null>(null);
  const dryRef = useRef<GainNode | null>(null);
  const fxSumRef = useRef<GainNode | null>(null);

  const reverbSendRef = useRef<GainNode | null>(null);
  const convolverRef = useRef<ConvolverNode | null>(null);
  const wetRef = useRef<GainNode | null>(null);

  const lowpassRef = useRef<BiquadFilterNode | null>(null);
  const outRef = useRef<GainNode | null>(null);

  const autoPanOscRef = useRef<OscillatorNode | null>(null);
  const autoPanGainRef = useRef<GainNode | null>(null);

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

    // Buses
    toneBusRef.current?.gain.setValueAtTime(clamp01(p.masterVolume, 0.5), ctx.currentTime);
    noiseBusRef.current?.gain.setValueAtTime(clamp01(p.noiseVolume, 0), ctx.currentTime);
    ambienceBusRef.current?.gain.setValueAtTime(clamp01(p.ambienceVolume, 0), ctx.currentTime);

    // Reverb
    if (reverbSendRef.current) {
      const amount = clamp01(p.effects?.reverb?.amount, 0);
      const send = p.effects?.reverb?.enabled ? amount : 0;
      reverbSendRef.current.gain.setValueAtTime(send, ctx.currentTime);
    }

    // Lowpass (bypass by Nyquist)
    if (lowpassRef.current) {
      const nyquist = ctx.sampleRate / 2;
      const raw = p.effects?.lowpass?.frequency;
      const freq = typeof raw === "number" && Number.isFinite(raw) ? raw : nyquist;
      const target = p.effects?.lowpass?.enabled ? Math.max(20, Math.min(nyquist, freq)) : nyquist;
      lowpassRef.current.frequency.setValueAtTime(target, ctx.currentTime);
    }

    // Noise-only autopan
    if (noisePannerRef.current) {
      if (p.effects?.autoPan?.enabled) {
        const rateRaw = p.effects.autoPan.rate;
        const rate = typeof rateRaw === "number" && Number.isFinite(rateRaw) ? rateRaw : 0.1;
        const depth = clamp01(p.effects.autoPan.depth, 0.5);

        if (!autoPanOscRef.current || !autoPanGainRef.current) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = rate;
          g.gain.value = depth;
          osc.connect(g);
          g.connect(noisePannerRef.current.pan);
          osc.start();
          autoPanOscRef.current = osc;
          autoPanGainRef.current = g;
        } else {
          autoPanOscRef.current.frequency.setValueAtTime(rate, ctx.currentTime);
          autoPanGainRef.current.gain.setValueAtTime(depth, ctx.currentTime);
        }
      } else {
        if (autoPanOscRef.current) {
          try {
            autoPanOscRef.current.stop();
            autoPanOscRef.current.disconnect();
          } catch {
            // ignore
          }
          autoPanOscRef.current = null;
        }
        if (autoPanGainRef.current) {
          try {
            autoPanGainRef.current.disconnect();
          } catch {
            // ignore
          }
          autoPanGainRef.current = null;
        }
        noisePannerRef.current.pan.setValueAtTime(0, ctx.currentTime);
      }
    }
  }, []);

  const init = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = ctxRef.current;

    if (!toneBusRef.current) toneBusRef.current = ctx.createGain();
    if (!noiseBusRef.current) noiseBusRef.current = ctx.createGain();
    if (!ambienceBusRef.current) ambienceBusRef.current = ctx.createGain();

    if (!noisePannerRef.current) noisePannerRef.current = ctx.createStereoPanner();

    if (!sumRef.current) sumRef.current = ctx.createGain();
    if (!dryRef.current) dryRef.current = ctx.createGain();
    if (!fxSumRef.current) fxSumRef.current = ctx.createGain();

    if (!reverbSendRef.current) reverbSendRef.current = ctx.createGain();
    if (!convolverRef.current) {
      convolverRef.current = ctx.createConvolver();
      convolverRef.current.buffer = createHallImpulse(ctx);
    }
    if (!wetRef.current) wetRef.current = ctx.createGain();

    if (!lowpassRef.current) {
      lowpassRef.current = ctx.createBiquadFilter();
      lowpassRef.current.type = "lowpass";
      lowpassRef.current.Q.value = 0.7;
    }

    if (!outRef.current) outRef.current = ctx.createGain();

    if (!wiredRef.current) {
      // Layer routing
      toneBusRef.current.connect(sumRef.current);
      ambienceBusRef.current.connect(sumRef.current);

      noiseBusRef.current.connect(noisePannerRef.current);
      noisePannerRef.current.connect(sumRef.current);

      // FX routing
      sumRef.current.connect(dryRef.current);
      dryRef.current.connect(fxSumRef.current);

      sumRef.current.connect(reverbSendRef.current);
      reverbSendRef.current.connect(convolverRef.current);
      convolverRef.current.connect(wetRef.current);
      wetRef.current.connect(fxSumRef.current);

      fxSumRef.current.connect(lowpassRef.current);
      lowpassRef.current.connect(outRef.current);
      outRef.current.connect(ctx.destination);

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
    return toneBusRef.current!;
  }, [ensure]);

  const getNoiseInput = useCallback(() => {
    ensure();
    return noiseBusRef.current!;
  }, [ensure]);

  const getAmbienceInput = useCallback(() => {
    ensure();
    return ambienceBusRef.current!;
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

    // Zero out all buses immediately
    toneBusRef.current?.gain.setValueAtTime(0, ctx.currentTime);
    noiseBusRef.current?.gain.setValueAtTime(0, ctx.currentTime);
    ambienceBusRef.current?.gain.setValueAtTime(0, ctx.currentTime);

    // Zero out reverb wet signal to kill tail
    wetRef.current?.gain.setValueAtTime(0, ctx.currentTime);
    reverbSendRef.current?.gain.setValueAtTime(0, ctx.currentTime);

    // Stop autopan
    if (autoPanOscRef.current) {
      try {
        autoPanOscRef.current.stop();
        autoPanOscRef.current.disconnect();
      } catch {
        // ignore
      }
      autoPanOscRef.current = null;
    }
    if (autoPanGainRef.current) {
      try {
        autoPanGainRef.current.disconnect();
      } catch {
        // ignore
      }
      autoPanGainRef.current = null;
    }
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
