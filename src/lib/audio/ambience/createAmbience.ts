import { AmbienceType } from "@/types/binaural";

export type RunningAmbience = {
  type: AmbienceType;
  sources: (AudioScheduledSourceNode | OscillatorNode)[];
  nodes: AudioNode[];
  stop: () => void;
};

function createWhiteNoiseBuffer(ctx: AudioContext, seconds: number) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function createRain(ctx: AudioContext, destination: AudioNode): RunningAmbience {
  const sources: (AudioScheduledSourceNode | OscillatorNode)[] = [];
  const nodes: AudioNode[] = [];

  const out = ctx.createGain();
  out.gain.value = 1;
  nodes.push(out);

  // Soft "air" bed
  const bed = ctx.createBufferSource();
  bed.buffer = createWhiteNoiseBuffer(ctx, 2.5);
  bed.loop = true;

  const bedHp = ctx.createBiquadFilter();
  bedHp.type = "highpass";
  bedHp.frequency.value = 500;

  const bedBp = ctx.createBiquadFilter();
  bedBp.type = "bandpass";
  bedBp.frequency.value = 1800;
  bedBp.Q.value = 0.6;

  const bedGain = ctx.createGain();
  bedGain.gain.value = 0.14;

  bed.connect(bedHp);
  bedHp.connect(bedBp);
  bedBp.connect(bedGain);
  bedGain.connect(out);

  sources.push(bed);
  nodes.push(bedHp, bedBp, bedGain);
  bed.start();

  // Raindrop layer: repeated tiny noise bursts through a resonant filter
  const dropsIn = ctx.createGain();
  const dropsBp = ctx.createBiquadFilter();
  dropsBp.type = "bandpass";
  dropsBp.frequency.value = 4200;
  dropsBp.Q.value = 10;

  const dropsHp = ctx.createBiquadFilter();
  dropsHp.type = "highpass";
  dropsHp.frequency.value = 1200;

  const dropsGain = ctx.createGain();
  dropsGain.gain.value = 0.22;

  dropsIn.connect(dropsBp);
  dropsBp.connect(dropsHp);
  dropsHp.connect(dropsGain);
  dropsGain.connect(out);

  nodes.push(dropsIn, dropsBp, dropsHp, dropsGain);

  let cancelled = false;
  const timeouts: number[] = [];

  const spawnDrop = () => {
    const burst = ctx.createBufferSource();
    burst.buffer = createWhiteNoiseBuffer(ctx, 0.06);
    burst.loop = false;

    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);

    burst.connect(g);
    g.connect(dropsIn);

    sources.push(burst);
    nodes.push(g);

    burst.start(t0);
    burst.stop(t0 + 0.07);
  };

  const schedule = () => {
    if (cancelled) return;
    // tighter spacing = "rain" rather than occasional drops
    const ms = 35 + Math.random() * 120;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      spawnDrop();
      schedule();
    }, ms);
    timeouts.push(id);
  };

  schedule();

  out.connect(destination);

  const stop = () => {
    cancelled = true;
    for (const id of timeouts) window.clearTimeout(id);

    for (const s of sources) {
      try {
        s.stop();
      } catch {
        // ignore
      }
    }
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        // ignore
      }
    }
    try {
      out.disconnect();
    } catch {
      // ignore
    }
  };

  return { type: "rain", sources, nodes, stop };
}

function createForest(ctx: AudioContext, destination: AudioNode): RunningAmbience {
  const sources: (AudioScheduledSourceNode | OscillatorNode)[] = [];
  const nodes: AudioNode[] = [];

  const out = ctx.createGain();
  out.gain.value = 1;
  nodes.push(out);

  // Wind/leaf bed (gentle filtered noise)
  const bed = ctx.createBufferSource();
  bed.buffer = createWhiteNoiseBuffer(ctx, 3.0);
  bed.loop = true;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 650;
  lp.Q.value = 0.2;

  const bedGain = ctx.createGain();
  bedGain.gain.value = 0.10;

  // slow movement
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.07;

  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.05;

  lfo.connect(lfoGain);
  lfoGain.connect(bedGain.gain);

  bed.connect(lp);
  lp.connect(bedGain);
  bedGain.connect(out);

  sources.push(bed, lfo);
  nodes.push(lp, bedGain, lfoGain);

  bed.start();
  lfo.start();

  // Bird chirps (random short sine sweeps)
  const chirpBus = ctx.createGain();
  chirpBus.gain.value = 0.18;

  const chirpBp = ctx.createBiquadFilter();
  chirpBp.type = "bandpass";
  chirpBp.frequency.value = 1800;
  chirpBp.Q.value = 2.2;

  chirpBus.connect(chirpBp);
  chirpBp.connect(out);

  nodes.push(chirpBus, chirpBp);

  let cancelled = false;
  const timeouts: number[] = [];

  const spawnChirp = () => {
    const osc = ctx.createOscillator();
    osc.type = "sine";

    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    const dur = 0.06 + Math.random() * 0.12;

    const f0 = 700 + Math.random() * 900;
    const f1 = 1400 + Math.random() * 1400;

    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);

    osc.connect(g);
    g.connect(chirpBus);

    sources.push(osc);
    nodes.push(g);

    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  };

  const schedule = () => {
    if (cancelled) return;
    // chirps every few seconds with clusters sometimes
    const ms = 900 + Math.random() * 3200;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      spawnChirp();
      if (Math.random() < 0.35) {
        const clusterId = window.setTimeout(() => {
          if (!cancelled) spawnChirp();
        }, 120);
        timeouts.push(clusterId);
      }
      schedule();
    }, ms);
    timeouts.push(id);
  };

  schedule();

  out.connect(destination);

  const stop = () => {
    cancelled = true;
    for (const id of timeouts) window.clearTimeout(id);

    for (const s of sources) {
      try {
        s.stop();
      } catch {
        // ignore
      }
    }
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        // ignore
      }
    }
    try {
      out.disconnect();
    } catch {
      // ignore
    }
  };

  return { type: "forest", sources, nodes, stop };
}

function createDrone(ctx: AudioContext, destination: AudioNode): RunningAmbience {
  const sources: (AudioScheduledSourceNode | OscillatorNode)[] = [];
  const nodes: AudioNode[] = [];

  const out = ctx.createGain();
  out.gain.value = 1;
  nodes.push(out);

  // Make it clearly audible even on small speakers
  const baseGain = ctx.createGain();
  baseGain.gain.value = 0.28;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1100;
  lp.Q.value = 0.8;

  // 3-osc stack for audibility + warmth
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.value = 55;

  const base = ctx.createOscillator();
  base.type = "triangle";
  base.frequency.value = 110;

  const overtone = ctx.createOscillator();
  overtone.type = "triangle";
  overtone.frequency.value = 220;

  // slow filter drift
  const drift = ctx.createOscillator();
  drift.type = "sine";
  drift.frequency.value = 0.05;

  const driftGain = ctx.createGain();
  driftGain.gain.value = 260;

  drift.connect(driftGain);
  driftGain.connect(lp.frequency);

  sub.connect(lp);
  base.connect(lp);
  overtone.connect(lp);
  lp.connect(baseGain);
  baseGain.connect(out);

  sources.push(sub, base, overtone, drift);
  nodes.push(baseGain, lp, driftGain);

  sub.start();
  base.start();
  overtone.start();
  drift.start();

  out.connect(destination);

  const stop = () => {
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        // ignore
      }
    }
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        // ignore
      }
    }
    try {
      out.disconnect();
    } catch {
      // ignore
    }
  };

  return { type: "drone", sources, nodes, stop };
}

export function createAmbience(ctx: AudioContext, type: AmbienceType, destination: AudioNode): RunningAmbience | null {
  if (type === "none") return null;
  if (type === "rain") return createRain(ctx, destination);
  if (type === "forest") return createForest(ctx, destination);
  return createDrone(ctx, destination);
}
