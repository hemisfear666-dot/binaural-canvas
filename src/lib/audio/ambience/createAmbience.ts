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

function createWindchimes(ctx: AudioContext, destination: AudioNode): RunningAmbience {
  const sources: (AudioScheduledSourceNode | OscillatorNode)[] = [];
  const nodes: AudioNode[] = [];

  const out = ctx.createGain();
  out.gain.value = 1;
  nodes.push(out);

  // Subtle wind bed
  const windBed = ctx.createBufferSource();
  windBed.buffer = createWhiteNoiseBuffer(ctx, 2.0);
  windBed.loop = true;

  const windLp = ctx.createBiquadFilter();
  windLp.type = "lowpass";
  windLp.frequency.value = 400;
  windLp.Q.value = 0.3;

  const windGain = ctx.createGain();
  windGain.gain.value = 0.04;

  windBed.connect(windLp);
  windLp.connect(windGain);
  windGain.connect(out);

  sources.push(windBed);
  nodes.push(windLp, windGain);
  windBed.start();

  // Chime frequencies (pentatonic scale in high register)
  const chimeFreqs = [523, 587, 659, 784, 880, 988, 1047, 1175, 1319];

  let cancelled = false;
  const timeouts: number[] = [];

  const spawnChime = () => {
    const freq = chimeFreqs[Math.floor(Math.random() * chimeFreqs.length)];
    const detune = (Math.random() - 0.5) * 20; // slight natural variation

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.detune.value = detune;

    // Add harmonics for metallic shimmer
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = freq * 2.4; // inharmonic partial
    osc2.detune.value = detune + 15;

    const osc3 = ctx.createOscillator();
    osc3.type = "sine";
    osc3.frequency.value = freq * 5.4;
    osc3.detune.value = detune - 10;

    const g = ctx.createGain();
    const g2 = ctx.createGain();
    const g3 = ctx.createGain();

    const t0 = ctx.currentTime;
    const decay = 1.5 + Math.random() * 2;

    g.gain.setValueAtTime(0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);

    g2.gain.setValueAtTime(0.06, t0);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + decay * 0.7);

    g3.gain.setValueAtTime(0.02, t0);
    g3.gain.exponentialRampToValueAtTime(0.0001, t0 + decay * 0.4);

    osc.connect(g);
    osc2.connect(g2);
    osc3.connect(g3);
    g.connect(out);
    g2.connect(out);
    g3.connect(out);

    sources.push(osc, osc2, osc3);
    nodes.push(g, g2, g3);

    osc.start(t0);
    osc2.start(t0);
    osc3.start(t0);
    osc.stop(t0 + decay + 0.1);
    osc2.stop(t0 + decay + 0.1);
    osc3.stop(t0 + decay + 0.1);
  };

  const schedule = () => {
    if (cancelled) return;
    // Random intervals with clusters
    const ms = 800 + Math.random() * 2500;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      spawnChime();
      // Sometimes play 2-3 chimes in quick succession (wind gust)
      if (Math.random() < 0.3) {
        const delay1 = 80 + Math.random() * 150;
        const clusterId = window.setTimeout(() => {
          if (!cancelled) spawnChime();
        }, delay1);
        timeouts.push(clusterId);
      }
      if (Math.random() < 0.15) {
        const delay2 = 200 + Math.random() * 200;
        const clusterId2 = window.setTimeout(() => {
          if (!cancelled) spawnChime();
        }, delay2);
        timeouts.push(clusterId2);
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
      try { s.stop(); } catch { /* ignore */ }
    }
    for (const n of nodes) {
      try { n.disconnect(); } catch { /* ignore */ }
    }
    try { out.disconnect(); } catch { /* ignore */ }
  };

  return { type: "windchimes", sources, nodes, stop };
}

function createGongs(ctx: AudioContext, destination: AudioNode): RunningAmbience {
  const sources: (AudioScheduledSourceNode | OscillatorNode)[] = [];
  const nodes: AudioNode[] = [];

  const out = ctx.createGain();
  out.gain.value = 1;
  nodes.push(out);

  // Deep ambient bed
  const bed = ctx.createOscillator();
  bed.type = "sine";
  bed.frequency.value = 55;

  const bedGain = ctx.createGain();
  bedGain.gain.value = 0.06;

  const bedLp = ctx.createBiquadFilter();
  bedLp.type = "lowpass";
  bedLp.frequency.value = 200;

  bed.connect(bedLp);
  bedLp.connect(bedGain);
  bedGain.connect(out);

  sources.push(bed);
  nodes.push(bedLp, bedGain);
  bed.start();

  // Gong frequencies (low, resonant)
  const gongFreqs = [65, 82, 98, 110, 131, 147];

  let cancelled = false;
  const timeouts: number[] = [];

  const spawnGong = () => {
    const freq = gongFreqs[Math.floor(Math.random() * gongFreqs.length)];
    const t0 = ctx.currentTime;
    const decay = 6 + Math.random() * 4;

    // Main tone
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    // Inharmonic partials for gong character
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = freq * 1.18;

    const osc3 = ctx.createOscillator();
    osc3.type = "sine";
    osc3.frequency.value = freq * 2.35;

    const osc4 = ctx.createOscillator();
    osc4.type = "sine";
    osc4.frequency.value = freq * 3.14;

    // Attack transient (metallic hit)
    const noise = ctx.createBufferSource();
    noise.buffer = createWhiteNoiseBuffer(ctx, 0.1);

    const noiseBp = ctx.createBiquadFilter();
    noiseBp.type = "bandpass";
    noiseBp.frequency.value = freq * 4;
    noiseBp.Q.value = 5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);

    noise.connect(noiseBp);
    noiseBp.connect(noiseGain);
    noiseGain.connect(out);

    // Gains with swell
    const g = ctx.createGain();
    const g2 = ctx.createGain();
    const g3 = ctx.createGain();
    const g4 = ctx.createGain();

    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.2, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);

    g2.gain.setValueAtTime(0, t0);
    g2.gain.linearRampToValueAtTime(0.12, t0 + 0.06);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + decay * 0.8);

    g3.gain.setValueAtTime(0, t0);
    g3.gain.linearRampToValueAtTime(0.06, t0 + 0.04);
    g3.gain.exponentialRampToValueAtTime(0.0001, t0 + decay * 0.6);

    g4.gain.setValueAtTime(0, t0);
    g4.gain.linearRampToValueAtTime(0.03, t0 + 0.03);
    g4.gain.exponentialRampToValueAtTime(0.0001, t0 + decay * 0.4);

    // Slow pitch drift for warmth
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.linearRampToValueAtTime(freq * 0.995, t0 + decay);

    osc.connect(g);
    osc2.connect(g2);
    osc3.connect(g3);
    osc4.connect(g4);
    g.connect(out);
    g2.connect(out);
    g3.connect(out);
    g4.connect(out);

    sources.push(osc, osc2, osc3, osc4, noise);
    nodes.push(g, g2, g3, g4, noiseBp, noiseGain);

    osc.start(t0);
    osc2.start(t0);
    osc3.start(t0);
    osc4.start(t0);
    noise.start(t0);

    osc.stop(t0 + decay + 0.1);
    osc2.stop(t0 + decay + 0.1);
    osc3.stop(t0 + decay + 0.1);
    osc4.stop(t0 + decay + 0.1);
    noise.stop(t0 + 0.15);
  };

  const schedule = () => {
    if (cancelled) return;
    // Gongs are spaced far apart for meditative feel
    const ms = 8000 + Math.random() * 12000;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      spawnGong();
      schedule();
    }, ms);
    timeouts.push(id);
  };

  // Initial gong after short delay
  const initId = window.setTimeout(() => {
    if (!cancelled) spawnGong();
    schedule();
  }, 2000);
  timeouts.push(initId);

  out.connect(destination);

  const stop = () => {
    cancelled = true;
    for (const id of timeouts) window.clearTimeout(id);

    for (const s of sources) {
      try { s.stop(); } catch { /* ignore */ }
    }
    for (const n of nodes) {
      try { n.disconnect(); } catch { /* ignore */ }
    }
    try { out.disconnect(); } catch { /* ignore */ }
  };

  return { type: "gongs", sources, nodes, stop };
}

function createOcean(ctx: AudioContext, destination: AudioNode): RunningAmbience {
  const sources: (AudioScheduledSourceNode | OscillatorNode)[] = [];
  const nodes: AudioNode[] = [];

  const out = ctx.createGain();
  out.gain.value = 1;
  nodes.push(out);

  // Ocean base - filtered noise with slow amplitude modulation for waves
  const waveBed = ctx.createBufferSource();
  waveBed.buffer = createWhiteNoiseBuffer(ctx, 4.0);
  waveBed.loop = true;

  const waveLp = ctx.createBiquadFilter();
  waveLp.type = "lowpass";
  waveLp.frequency.value = 800;
  waveLp.Q.value = 0.4;

  const waveHp = ctx.createBiquadFilter();
  waveHp.type = "highpass";
  waveHp.frequency.value = 80;

  const waveGain = ctx.createGain();
  waveGain.gain.value = 0.25;

  // Slow wave amplitude LFO
  const waveLfo = ctx.createOscillator();
  waveLfo.type = "sine";
  waveLfo.frequency.value = 0.08; // Very slow waves

  const waveLfoGain = ctx.createGain();
  waveLfoGain.gain.value = 0.12;

  waveLfo.connect(waveLfoGain);
  waveLfoGain.connect(waveGain.gain);

  waveBed.connect(waveLp);
  waveLp.connect(waveHp);
  waveHp.connect(waveGain);
  waveGain.connect(out);

  sources.push(waveBed, waveLfo);
  nodes.push(waveLp, waveHp, waveGain, waveLfoGain);

  waveBed.start();
  waveLfo.start();

  // Foam/surf layer - higher frequency crashing
  const foamBed = ctx.createBufferSource();
  foamBed.buffer = createWhiteNoiseBuffer(ctx, 2.0);
  foamBed.loop = true;

  const foamBp = ctx.createBiquadFilter();
  foamBp.type = "bandpass";
  foamBp.frequency.value = 2500;
  foamBp.Q.value = 0.8;

  const foamGain = ctx.createGain();
  foamGain.gain.value = 0.08;

  // Foam LFO slightly offset from wave
  const foamLfo = ctx.createOscillator();
  foamLfo.type = "sine";
  foamLfo.frequency.value = 0.12;

  const foamLfoGain = ctx.createGain();
  foamLfoGain.gain.value = 0.06;

  foamLfo.connect(foamLfoGain);
  foamLfoGain.connect(foamGain.gain);

  foamBed.connect(foamBp);
  foamBp.connect(foamGain);
  foamGain.connect(out);

  sources.push(foamBed, foamLfo);
  nodes.push(foamBp, foamGain, foamLfoGain);

  foamBed.start();
  foamLfo.start();

  // Deep undertow rumble
  const rumble = ctx.createOscillator();
  rumble.type = "sine";
  rumble.frequency.value = 35;

  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0.06;

  const rumbleLfo = ctx.createOscillator();
  rumbleLfo.type = "sine";
  rumbleLfo.frequency.value = 0.05;

  const rumbleLfoGain = ctx.createGain();
  rumbleLfoGain.gain.value = 0.03;

  rumbleLfo.connect(rumbleLfoGain);
  rumbleLfoGain.connect(rumbleGain.gain);

  rumble.connect(rumbleGain);
  rumbleGain.connect(out);

  sources.push(rumble, rumbleLfo);
  nodes.push(rumbleGain, rumbleLfoGain);

  rumble.start();
  rumbleLfo.start();

  out.connect(destination);

  const stop = () => {
    for (const s of sources) {
      try { s.stop(); } catch { /* ignore */ }
    }
    for (const n of nodes) {
      try { n.disconnect(); } catch { /* ignore */ }
    }
    try { out.disconnect(); } catch { /* ignore */ }
  };

  return { type: "ocean", sources, nodes, stop };
}

function createFan(ctx: AudioContext, destination: AudioNode): RunningAmbience {
  const sources: (AudioScheduledSourceNode | OscillatorNode)[] = [];
  const nodes: AudioNode[] = [];

  const out = ctx.createGain();
  out.gain.value = 1;
  nodes.push(out);

  // Main fan noise - filtered white noise with characteristic hum
  const fanNoise = ctx.createBufferSource();
  fanNoise.buffer = createWhiteNoiseBuffer(ctx, 2.0);
  fanNoise.loop = true;

  // Bandpass for that characteristic fan sound
  const fanBp = ctx.createBiquadFilter();
  fanBp.type = "bandpass";
  fanBp.frequency.value = 350;
  fanBp.Q.value = 0.3;

  // Low pass to remove harshness
  const fanLp = ctx.createBiquadFilter();
  fanLp.type = "lowpass";
  fanLp.frequency.value = 1200;

  const fanGain = ctx.createGain();
  fanGain.gain.value = 0.22;

  fanNoise.connect(fanBp);
  fanBp.connect(fanLp);
  fanLp.connect(fanGain);
  fanGain.connect(out);

  sources.push(fanNoise);
  nodes.push(fanBp, fanLp, fanGain);
  fanNoise.start();

  // Motor hum (very subtle low frequency)
  const hum = ctx.createOscillator();
  hum.type = "sine";
  hum.frequency.value = 60; // 60Hz motor hum

  const humGain = ctx.createGain();
  humGain.gain.value = 0.015;

  hum.connect(humGain);
  humGain.connect(out);

  sources.push(hum);
  nodes.push(humGain);
  hum.start();

  // Blade whoosh - subtle periodic emphasis
  const whooshLfo = ctx.createOscillator();
  whooshLfo.type = "sine";
  whooshLfo.frequency.value = 2.5; // ~150 RPM fan

  const whooshLfoGain = ctx.createGain();
  whooshLfoGain.gain.value = 0.02;

  whooshLfo.connect(whooshLfoGain);
  whooshLfoGain.connect(fanGain.gain);

  sources.push(whooshLfo);
  nodes.push(whooshLfoGain);
  whooshLfo.start();

  // Higher air movement layer
  const airNoise = ctx.createBufferSource();
  airNoise.buffer = createWhiteNoiseBuffer(ctx, 1.5);
  airNoise.loop = true;

  const airHp = ctx.createBiquadFilter();
  airHp.type = "highpass";
  airHp.frequency.value = 800;

  const airLp = ctx.createBiquadFilter();
  airLp.type = "lowpass";
  airLp.frequency.value = 3000;

  const airGain = ctx.createGain();
  airGain.gain.value = 0.06;

  airNoise.connect(airHp);
  airHp.connect(airLp);
  airLp.connect(airGain);
  airGain.connect(out);

  sources.push(airNoise);
  nodes.push(airHp, airLp, airGain);
  airNoise.start();

  out.connect(destination);

  const stop = () => {
    for (const s of sources) {
      try { s.stop(); } catch { /* ignore */ }
    }
    for (const n of nodes) {
      try { n.disconnect(); } catch { /* ignore */ }
    }
    try { out.disconnect(); } catch { /* ignore */ }
  };

  return { type: "fan", sources, nodes, stop };
}

export function createAmbience(ctx: AudioContext, type: AmbienceType, destination: AudioNode): RunningAmbience | null {
  if (type === "none") return null;
  if (type === "rain") return createRain(ctx, destination);
  if (type === "forest") return createForest(ctx, destination);
  if (type === "drone") return createDrone(ctx, destination);
  if (type === "windchimes") return createWindchimes(ctx, destination);
  if (type === "gongs") return createGongs(ctx, destination);
  if (type === "ocean") return createOcean(ctx, destination);
  if (type === "fan") return createFan(ctx, destination);
  return null;
}
