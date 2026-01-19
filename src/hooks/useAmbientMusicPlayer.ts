import { useCallback, useEffect, useRef } from "react";
import { AmbientMusicType } from "@/types/binaural";
import { resumeAudioContext } from "@/lib/audio/resumeAudioContext";

// Generate ambient music in real-time using Web Audio synthesis
// Each type has distinctly different characteristics

interface RunningAmbient {
  type: AmbientMusicType;
  nodes: AudioNode[];
  oscillators: OscillatorNode[];
  stop: () => void;
}

function createSoothingAmbient(ctx: AudioContext, dest: AudioNode): RunningAmbient {
  // Warm, major chord pad with slow movement
  const oscillators: OscillatorNode[] = [];
  const nodes: AudioNode[] = [];

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.15;
  nodes.push(masterGain);

  // A major chord: A3, C#4, E4
  const freqs = [220, 277.18, 329.63];

  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    // Slow detune LFO for warmth
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.05 + i * 0.02;
    
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 2; // 2 cents detune
    
    lfo.connect(lfoGain);
    lfoGain.connect(osc.detune);

    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.3;

    osc.connect(oscGain);
    oscGain.connect(masterGain);

    oscillators.push(osc, lfo);
    nodes.push(lfoGain, oscGain);

    osc.start();
    lfo.start();
  });

  // Soft lowpass filter
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 800;
  filter.Q.value = 0.5;
  nodes.push(filter);

  masterGain.connect(filter);
  filter.connect(dest);

  return {
    type: "soothing",
    nodes,
    oscillators,
    stop: () => {
      oscillators.forEach(o => { try { o.stop(); o.disconnect(); } catch {} });
      nodes.forEach(n => { try { n.disconnect(); } catch {} });
    }
  };
}

function createFocusAmbient(ctx: AudioContext, dest: AudioNode): RunningAmbient {
  // Minimal, steady drone with subtle pulse - less musical, more "white noise adjacent"
  const oscillators: OscillatorNode[] = [];
  const nodes: AudioNode[] = [];

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.12;
  nodes.push(masterGain);

  // Low fundamental with fifth - very stable
  const osc1 = ctx.createOscillator();
  osc1.type = "triangle";
  osc1.frequency.value = 110; // A2

  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = 165; // E3 (fifth)

  const gain1 = ctx.createGain();
  gain1.gain.value = 0.4;
  const gain2 = ctx.createGain();
  gain2.gain.value = 0.25;

  osc1.connect(gain1);
  osc2.connect(gain2);
  gain1.connect(masterGain);
  gain2.connect(masterGain);

  oscillators.push(osc1, osc2);
  nodes.push(gain1, gain2);

  // Very subtle amplitude modulation for "life"
  const ampLfo = ctx.createOscillator();
  ampLfo.type = "sine";
  ampLfo.frequency.value = 0.08;
  const ampGain = ctx.createGain();
  ampGain.gain.value = 0.02;
  ampLfo.connect(ampGain);
  ampGain.connect(masterGain.gain);
  oscillators.push(ampLfo);
  nodes.push(ampGain);

  // Lowpass
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 500;
  nodes.push(filter);

  masterGain.connect(filter);
  filter.connect(dest);

  osc1.start();
  osc2.start();
  ampLfo.start();

  return {
    type: "focus",
    nodes,
    oscillators,
    stop: () => {
      oscillators.forEach(o => { try { o.stop(); o.disconnect(); } catch {} });
      nodes.forEach(n => { try { n.disconnect(); } catch {} });
    }
  };
}

function createSleepAmbient(ctx: AudioContext, dest: AudioNode): RunningAmbient {
  // Deep, dark drone - very low frequencies, minimal movement
  const oscillators: OscillatorNode[] = [];
  const nodes: AudioNode[] = [];

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.2;
  nodes.push(masterGain);

  // Very low frequencies
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.value = 55; // A1

  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = 82.41; // E2

  const osc3 = ctx.createOscillator();
  osc3.type = "sine";
  osc3.frequency.value = 110; // A2

  const gains = [0.5, 0.3, 0.15];
  [osc1, osc2, osc3].forEach((osc, i) => {
    const g = ctx.createGain();
    g.gain.value = gains[i];
    osc.connect(g);
    g.connect(masterGain);
    oscillators.push(osc);
    nodes.push(g);
  });

  // Very slow breathing modulation
  const breathLfo = ctx.createOscillator();
  breathLfo.type = "sine";
  breathLfo.frequency.value = 0.03; // Very slow
  const breathGain = ctx.createGain();
  breathGain.gain.value = 0.05;
  breathLfo.connect(breathGain);
  breathGain.connect(masterGain.gain);
  oscillators.push(breathLfo);
  nodes.push(breathGain);

  // Heavy lowpass
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 300;
  filter.Q.value = 0.3;
  nodes.push(filter);

  masterGain.connect(filter);
  filter.connect(dest);

  osc1.start();
  osc2.start();
  osc3.start();
  breathLfo.start();

  return {
    type: "sleep",
    nodes,
    oscillators,
    stop: () => {
      oscillators.forEach(o => { try { o.stop(); o.disconnect(); } catch {} });
      nodes.forEach(n => { try { n.disconnect(); } catch {} });
    }
  };
}

function createAmbient(ctx: AudioContext, type: AmbientMusicType, dest: AudioNode): RunningAmbient {
  switch (type) {
    case "soothing": return createSoothingAmbient(ctx, dest);
    case "focus": return createFocusAmbient(ctx, dest);
    case "sleep": return createSleepAmbient(ctx, dest);
    default: return createSoothingAmbient(ctx, dest);
  }
}

export function useAmbientMusicPlayer(
  ensureCtx: () => AudioContext,
  getDestination: () => GainNode,
  enabled: boolean,
  type: AmbientMusicType
) {
  const runningRef = useRef<RunningAmbient | null>(null);
  const previewRef = useRef<RunningAmbient | null>(null);
  const ensureCtxRef = useRef(ensureCtx);
  const getDestRef = useRef(getDestination);

  useEffect(() => {
    ensureCtxRef.current = ensureCtx;
    getDestRef.current = getDestination;
  }, [ensureCtx, getDestination]);

  const stopTrack = useCallback((track: RunningAmbient | null) => {
    if (track) track.stop();
  }, []);

  // Main playback
  useEffect(() => {
    if (!enabled) {
      if (runningRef.current) {
        stopTrack(runningRef.current);
        runningRef.current = null;
      }
      return;
    }

    const ctx = ensureCtxRef.current();
    void resumeAudioContext(ctx, "ambient-music");
    const dest = getDestRef.current();

    // Stop previous if type changed
    if (runningRef.current && runningRef.current.type !== type) {
      stopTrack(runningRef.current);
      runningRef.current = null;
    }

    if (!runningRef.current) {
      runningRef.current = createAmbient(ctx, type, dest);
    }

    return () => {
      if (runningRef.current) {
        stopTrack(runningRef.current);
        runningRef.current = null;
      }
    };
  }, [enabled, type, stopTrack]);

  const startPreview = useCallback(async (previewType: AmbientMusicType) => {
    if (previewRef.current) {
      stopTrack(previewRef.current);
      previewRef.current = null;
    }

    const ctx = ensureCtxRef.current();
    await resumeAudioContext(ctx, "ambient-music-preview");
    const dest = getDestRef.current();

    previewRef.current = createAmbient(ctx, previewType, dest);
  }, [stopTrack]);

  const stopPreview = useCallback(() => {
    if (previewRef.current) {
      stopTrack(previewRef.current);
      previewRef.current = null;
    }
  }, [stopTrack]);

  return { startPreview, stopPreview };
}
