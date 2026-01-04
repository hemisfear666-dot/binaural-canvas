import { useCallback, useEffect, useRef } from "react";
import type { EffectsSettings } from "@/types/binaural";

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

    // Buses
    toneBusRef.current?.gain.setValueAtTime(p.masterVolume, ctx.currentTime);
    noiseBusRef.current?.gain.setValueAtTime(p.noiseVolume, ctx.currentTime);
    ambienceBusRef.current?.gain.setValueAtTime(p.ambienceVolume, ctx.currentTime);

    // Reverb
    if (reverbSendRef.current) {
      const send = p.effects.reverb.enabled ? p.effects.reverb.amount : 0;
      reverbSendRef.current.gain.setValueAtTime(send, ctx.currentTime);
    }

    // Lowpass (bypass by Nyquist)
    if (lowpassRef.current) {
      const nyquist = ctx.sampleRate / 2;
      const target = p.effects.lowpass.enabled ? p.effects.lowpass.frequency : nyquist;
      lowpassRef.current.frequency.setValueAtTime(target, ctx.currentTime);
    }

    // Noise-only autopan
    if (noisePannerRef.current) {
      if (p.effects.autoPan.enabled) {
        if (!autoPanOscRef.current || !autoPanGainRef.current) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = p.effects.autoPan.rate;
          g.gain.value = p.effects.autoPan.depth;
          osc.connect(g);
          g.connect(noisePannerRef.current.pan);
          osc.start();
          autoPanOscRef.current = osc;
          autoPanGainRef.current = g;
        } else {
          autoPanOscRef.current.frequency.setValueAtTime(p.effects.autoPan.rate, ctx.currentTime);
          autoPanGainRef.current.gain.setValueAtTime(p.effects.autoPan.depth, ctx.currentTime);
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
    if (ctx.state === "suspended") ctx.resume();
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

  return {
    ensure,
    getToneInput,
    getNoiseInput,
    getAmbienceInput,
  };
}
