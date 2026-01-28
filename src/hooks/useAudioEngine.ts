import { useRef, useCallback, useEffect, useState } from 'react';
import { Section, PlaybackState, WaveformType, LoopMode } from '@/types/binaural';
import { resumeAudioContext } from '@/lib/audio/resumeAudioContext';

interface AudioEngineState {
  playbackState: PlaybackState;
  currentTime: number;
  currentSectionIndex: number | null;
  testingIndex: number | null;
}

type GetAudioContext = () => AudioContext;

type ScheduledSectionGain = {
  sectionId: string;
  gain: GainNode;
  startTime: number;
  endTime: number;
};

export function useAudioEngine(
  sections: Section[],
  isIsochronic: boolean,
  waveform: WaveformType,
  getAudioContext: GetAudioContext,
  getOutputNode: () => AudioNode,
  loopMode: LoopMode = 'off',
  onLoopModeChange?: (mode: LoopMode) => void
) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  const activeNodesRef = useRef<AudioNode[]>([]);
  const testNodesRef = useRef<AudioNode[]>([]);
  const scheduledGainsRef = useRef<ScheduledSectionGain[]>([]);

  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const playbackStartRef = useRef<number>(0);
  const wasPlayingBeforeTestRef = useRef<boolean>(false);
  const pausedTimeRef = useRef<number>(0);
  
  // For live test updates
  const testOscillatorRef = useRef<{
    oscL?: OscillatorNode;
    oscR?: OscillatorNode;
    osc?: OscillatorNode;
    lfo?: OscillatorNode;
    sectionIndex: number;
  } | null>(null);

  const [state, setState] = useState<AudioEngineState>({
    playbackState: 'stopped',
    currentTime: 0,
    currentSectionIndex: null,
    testingIndex: null,
  });

  const ensureAudioRunning = useCallback(async () => {
    const ctx = getAudioContext();
    audioCtxRef.current = ctx;

    // If the AudioContext ever gets recreated (HMR, browser quirks), the old GainNode
    // belongs to a different context and will silently produce no audio.
    const needsNewMaster = !masterGainRef.current || masterGainRef.current.context !== ctx;
    if (needsNewMaster) {
      try {
        masterGainRef.current?.disconnect();
      } catch {
        // ignore
      }
      masterGainRef.current = ctx.createGain();
      masterGainRef.current.gain.value = 1;
      masterGainRef.current.connect(getOutputNode());
    }

    const ok = await resumeAudioContext(ctx, 'engine');
    if (!ok) {
      // No toast here (avoid UI side effects); log so we can diagnose if it happens again.
      console.warn('[engine] AudioContext not running; user gesture may be required');
    }
    return ok;
  }, [getAudioContext, getOutputNode]);

  // Backwards-compatible init: kick off resume but don't await (some callers just want wiring).
  const initAudio = useCallback(() => {
    void ensureAudioRunning();
  }, [ensureAudioRunning]);

  const cleanupNodes = useCallback((nodes: AudioNode[]) => {
    nodes.forEach((node) => {
      try {
        if (node instanceof OscillatorNode) node.stop();
        node.disconnect();
      } catch {
        // ignore
      }
    });
  }, []);

  const cleanupMainNodes = useCallback(() => {
    cleanupNodes(activeNodesRef.current);
    activeNodesRef.current = [];
    scheduledGainsRef.current = [];
    activeOscillatorsRef.current.clear();
  }, [cleanupNodes]);

  const cleanupTestNodes = useCallback(() => {
    cleanupNodes(testNodesRef.current);
    testNodesRef.current = [];
    testOscillatorRef.current = null;
  }, [cleanupNodes]);

  // Softening filter for harsh waveforms
  const createLowPassFilter = useCallback((ctx: AudioContext): BiquadFilterNode => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300; // warm softening
    filter.Q.value = 0.7;
    return filter;
  }, []);

  const getRampEnabled = useCallback((section: Section) => {
    const hasTargets = section.endCarrier !== undefined || section.endBeat !== undefined;
    return section.rampEnabled ?? hasTargets;
  }, []);

  // Track active oscillators by section ID for live updates
  const activeOscillatorsRef = useRef<Map<string, {
    oscL?: OscillatorNode;
    oscR?: OscillatorNode;
    osc?: OscillatorNode;
    lfo?: OscillatorNode;
    filterL?: BiquadFilterNode;
    filterR?: BiquadFilterNode;
    filter?: BiquadFilterNode;
    endTime: number;
  }>>(new Map());

  // Store waveform ref for live updates
  const waveformRef = useRef(waveform);
  useEffect(() => {
    waveformRef.current = waveform;
  }, [waveform]);

  const playTone = useCallback(
    (
      opts: {
        sectionId: string;
        carrier: number;
        endCarrier: number | undefined;
        beat: number;
        endBeat: number | undefined;
        rampEnabled: boolean;
        duration: number;
        volume: number;
        muted: boolean;
        startOffset?: number;
        isTest?: boolean;
      }
    ) => {
      if (!audioCtxRef.current || !masterGainRef.current) return;

      const ctx = audioCtxRef.current;
      const startOffset = opts.startOffset ?? 0;
      const now = ctx.currentTime + startOffset;
      const endTime = now + opts.duration;

      const needsFilter = waveform !== 'sine';

      const sectionGain = ctx.createGain();
      sectionGain.gain.setValueAtTime(opts.muted ? 0 : opts.volume, now);

      const nodesToTrack = opts.isTest ? testNodesRef.current : activeNodesRef.current;
      if (!opts.isTest) {
        scheduledGainsRef.current.push({
          sectionId: opts.sectionId,
          gain: sectionGain,
          startTime: now,
          endTime,
        });
      }

      const finalCarrier = opts.rampEnabled ? (opts.endCarrier ?? opts.carrier) : opts.carrier;
      const finalBeat = opts.rampEnabled ? (opts.endBeat ?? opts.beat) : opts.beat;

      if (isIsochronic) {
        const osc = ctx.createOscillator();
        osc.type = waveform;
        osc.frequency.setValueAtTime(opts.carrier, now);
        if (opts.rampEnabled && opts.endCarrier !== undefined && opts.endCarrier !== opts.carrier) {
          osc.frequency.linearRampToValueAtTime(finalCarrier, endTime);
        }

        const amp = ctx.createGain();
        amp.gain.value = 0.5;

        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(opts.beat, now);
        if (opts.rampEnabled && opts.endBeat !== undefined && opts.endBeat !== opts.beat) {
          lfo.frequency.linearRampToValueAtTime(finalBeat, endTime);
        }

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.5;

        lfo.connect(lfoGain);
        lfoGain.connect(amp.gain);

        if (needsFilter) {
          const filter = createLowPassFilter(ctx);
          osc.connect(filter);
          filter.connect(amp);
          nodesToTrack.push(filter);
        } else {
          osc.connect(amp);
        }

        amp.connect(sectionGain);
        sectionGain.connect(masterGainRef.current);

        osc.start(now);
        lfo.start(now);
        osc.stop(endTime);
        lfo.stop(endTime);

        nodesToTrack.push(osc, lfo, amp, lfoGain, sectionGain);
        
        // Track oscillators for live updates
        if (!opts.isTest) {
          activeOscillatorsRef.current.set(opts.sectionId, { osc, lfo, endTime });
        }
      } else {
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        oscL.type = waveform;
        oscR.type = waveform;

        const panL = ctx.createStereoPanner();
        const panR = ctx.createStereoPanner();
        panL.pan.value = -1;
        panR.pan.value = 1;

        const leftFreqStart = opts.carrier - opts.beat / 2;
        const rightFreqStart = opts.carrier + opts.beat / 2;
        oscL.frequency.setValueAtTime(leftFreqStart, now);
        oscR.frequency.setValueAtTime(rightFreqStart, now);

        if (opts.rampEnabled && ((opts.endCarrier !== undefined && opts.endCarrier !== opts.carrier) || (opts.endBeat !== undefined && opts.endBeat !== opts.beat))) {
          const leftFreqEnd = finalCarrier - finalBeat / 2;
          const rightFreqEnd = finalCarrier + finalBeat / 2;
          oscL.frequency.linearRampToValueAtTime(leftFreqEnd, endTime);
          oscR.frequency.linearRampToValueAtTime(rightFreqEnd, endTime);
        }

        if (needsFilter) {
          const filterL = createLowPassFilter(ctx);
          const filterR = createLowPassFilter(ctx);
          oscL.connect(filterL);
          oscR.connect(filterR);
          filterL.connect(panL);
          filterR.connect(panR);
          nodesToTrack.push(filterL, filterR);
        } else {
          oscL.connect(panL);
          oscR.connect(panR);
        }

        panL.connect(sectionGain);
        panR.connect(sectionGain);
        sectionGain.connect(masterGainRef.current);

        oscL.start(now);
        oscR.start(now);
        oscL.stop(endTime);
        oscR.stop(endTime);

        nodesToTrack.push(oscL, oscR, panL, panR, sectionGain);
        
        // Track oscillators for live updates
        if (!opts.isTest) {
          activeOscillatorsRef.current.set(opts.sectionId, { oscL, oscR, endTime });
        }
      }
    },
    [createLowPassFilter, isIsochronic, waveform]
  );

  const getTotalDuration = useCallback(() => {
    return sections.reduce((acc, section) => acc + section.duration, 0);
  }, [sections]);

  const getCurrentSection = useCallback(
    (time: number) => {
      let elapsed = 0;
      for (let i = 0; i < sections.length; i++) {
        if (time >= elapsed && time < elapsed + sections[i].duration) return i;
        elapsed += sections[i].duration;
      }
      return null;
    },
    [sections]
  );

  // Ref for loop mode to avoid stale closures
  const loopModeRef = useRef(loopMode);
  useEffect(() => {
    loopModeRef.current = loopMode;
  }, [loopMode]);

  // Track if we've done the repeat-once replay
  const hasRepeatedOnceRef = useRef(false);

  // Helper to schedule all sections from a given time
  const scheduleAllSections = useCallback((fromTime: number) => {
    if (!audioCtxRef.current) return;

    let timeAccumulator = 0;
    sections.forEach((section) => {
      const rampEnabled = getRampEnabled(section);

      if (timeAccumulator + section.duration > fromTime && !section.muted) {
        const sectionStart = Math.max(0, fromTime - timeAccumulator);
        const sectionDuration = section.duration - sectionStart;
        const startOffset = Math.max(0, timeAccumulator - fromTime);

        const progress = sectionStart / section.duration;

        const currentCarrier = rampEnabled && section.endCarrier !== undefined
          ? section.carrier + (section.endCarrier - section.carrier) * progress
          : section.carrier;

        const currentBeat = rampEnabled && section.endBeat !== undefined
          ? section.beat + (section.endBeat - section.beat) * progress
          : section.beat;

        playTone({
          sectionId: section.id,
          carrier: currentCarrier,
          endCarrier: section.endCarrier,
          beat: currentBeat,
          endBeat: section.endBeat,
          rampEnabled,
          duration: sectionDuration,
          volume: section.volume,
          muted: section.muted,
          startOffset,
          isTest: false,
        });
      }
      timeAccumulator += section.duration;
    });
  }, [sections, getRampEnabled, playTone]);

  // Keep a ref to scheduleAllSections so updateTime always has the latest version
  const scheduleAllSectionsRef = useRef(scheduleAllSections);
  useEffect(() => {
    scheduleAllSectionsRef.current = scheduleAllSections;
  }, [scheduleAllSections]);

  const updateTime = useCallback(() => {
    if (state.playbackState !== 'playing' || !audioCtxRef.current) return;

    const elapsed = audioCtxRef.current.currentTime - playbackStartRef.current + startTimeRef.current;
    const totalDuration = getTotalDuration();

    if (elapsed >= totalDuration) {
      const currentLoopMode = loopModeRef.current;

      if (currentLoopMode === 'loop') {
        // Continuous loop: restart from beginning
        cleanupMainNodes();
        startTimeRef.current = 0;
        playbackStartRef.current = audioCtxRef.current.currentTime;
        // Re-schedule all sections using ref
        scheduleAllSectionsRef.current(0);
        setState((prev) => ({
          ...prev,
          currentTime: 0,
          currentSectionIndex: getCurrentSection(0),
        }));
        animationFrameRef.current = requestAnimationFrame(updateTime);
        return;
      } else if (currentLoopMode === 'repeat-once' && !hasRepeatedOnceRef.current) {
        // Repeat once: restart once, then stop
        hasRepeatedOnceRef.current = true;
        cleanupMainNodes();
        startTimeRef.current = 0;
        playbackStartRef.current = audioCtxRef.current.currentTime;
        // Re-schedule all sections using ref
        scheduleAllSectionsRef.current(0);
        setState((prev) => ({
          ...prev,
          currentTime: 0,
          currentSectionIndex: getCurrentSection(0),
        }));
        // Switch mode to off after the repeat
        onLoopModeChange?.('off');
        animationFrameRef.current = requestAnimationFrame(updateTime);
        return;
      }

      // Default: stop
      setState((prev) => ({
        ...prev,
        playbackState: 'stopped',
        currentTime: 0,
        currentSectionIndex: null,
      }));
      cleanupMainNodes();
      hasRepeatedOnceRef.current = false;
      return;
    }

    setState((prev) => ({
      ...prev,
      currentTime: elapsed,
      currentSectionIndex: getCurrentSection(elapsed),
    }));

    animationFrameRef.current = requestAnimationFrame(updateTime);
  }, [cleanupMainNodes, getCurrentSection, getTotalDuration, state.playbackState, onLoopModeChange]);

  useEffect(() => {
    if (state.playbackState === 'playing') {
      animationFrameRef.current = requestAnimationFrame(updateTime);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [state.playbackState, updateTime]);

  // Live per-section volume/mute updates while playing (no restarts)
  useEffect(() => {
    if (state.playbackState !== 'playing' || !audioCtxRef.current) return;

    const ctx = audioCtxRef.current;
    const byId = new Map(sections.map((s) => [s.id, s] as const));

    for (const scheduled of scheduledGainsRef.current) {
      const s = byId.get(scheduled.sectionId);
      if (!s) continue;
      const t = ctx.currentTime;
      if (t < scheduled.startTime || t > scheduled.endTime) continue;
      scheduled.gain.gain.setValueAtTime(s.muted ? 0 : s.volume, t);
    }
  }, [sections, state.playbackState]);

  // Live ramp parameter + frequency + waveform updates while playing
  useEffect(() => {
    if (state.playbackState !== 'playing' || !audioCtxRef.current) return;

    const ctx = audioCtxRef.current;
    const byId = new Map(sections.map((s) => [s.id, s] as const));
    const now = ctx.currentTime;

    for (const [sectionId, oscData] of activeOscillatorsRef.current.entries()) {
      const section = byId.get(sectionId);
      if (!section) continue;
      if (now > oscData.endTime) continue;

      const rampEnabled = getRampEnabled(section);
      const remainingTime = oscData.endTime - now;

      if (isIsochronic) {
        // Isochronic mode: single osc + lfo
        if (oscData.osc && oscData.lfo) {
          // Live waveform change
          if (oscData.osc.type !== waveform) {
            oscData.osc.type = waveform;
          }

          const targetCarrier = rampEnabled && section.endCarrier !== undefined ? section.endCarrier : section.carrier;
          const targetBeat = rampEnabled && section.endBeat !== undefined ? section.endBeat : section.beat;

          // If ramp is enabled, set up the ramp from current value to target
          // If ramp is disabled, immediately set to section's current carrier/beat
          oscData.osc.frequency.cancelScheduledValues(now);
          oscData.lfo.frequency.cancelScheduledValues(now);

          if (rampEnabled && (section.endCarrier !== undefined || section.endBeat !== undefined)) {
            oscData.osc.frequency.setValueAtTime(oscData.osc.frequency.value, now);
            oscData.osc.frequency.linearRampToValueAtTime(targetCarrier, now + remainingTime);

            oscData.lfo.frequency.setValueAtTime(oscData.lfo.frequency.value, now);
            oscData.lfo.frequency.linearRampToValueAtTime(targetBeat, now + remainingTime);
          } else {
            // No ramp - jump to current section frequency immediately
            oscData.osc.frequency.setValueAtTime(section.carrier, now);
            oscData.lfo.frequency.setValueAtTime(section.beat, now);
          }
        }
      } else {
        // Binaural mode: left + right oscillators
        if (oscData.oscL && oscData.oscR) {
          // Live waveform change
          if (oscData.oscL.type !== waveform) {
            oscData.oscL.type = waveform;
            oscData.oscR.type = waveform;
          }

          const targetCarrier = rampEnabled && section.endCarrier !== undefined ? section.endCarrier : section.carrier;
          const targetBeat = rampEnabled && section.endBeat !== undefined ? section.endBeat : section.beat;

          const targetLeftFreq = targetCarrier - targetBeat / 2;
          const targetRightFreq = targetCarrier + targetBeat / 2;

          oscData.oscL.frequency.cancelScheduledValues(now);
          oscData.oscR.frequency.cancelScheduledValues(now);

          if (rampEnabled && (section.endCarrier !== undefined || section.endBeat !== undefined)) {
            oscData.oscL.frequency.setValueAtTime(oscData.oscL.frequency.value, now);
            oscData.oscR.frequency.setValueAtTime(oscData.oscR.frequency.value, now);

            oscData.oscL.frequency.linearRampToValueAtTime(targetLeftFreq, now + remainingTime);
            oscData.oscR.frequency.linearRampToValueAtTime(targetRightFreq, now + remainingTime);
          } else {
            // No ramp - jump to current section frequency immediately
            const leftFreq = section.carrier - section.beat / 2;
            const rightFreq = section.carrier + section.beat / 2;
            oscData.oscL.frequency.setValueAtTime(leftFreq, now);
            oscData.oscR.frequency.setValueAtTime(rightFreq, now);
          }
        }
      }
    }
  }, [sections, state.playbackState, isIsochronic, waveform, getRampEnabled]);

  // Live update test oscillator when section frequencies change (frequency generator)
  useEffect(() => {
    if (state.testingIndex === null || !testOscillatorRef.current || !audioCtxRef.current) return;

    const section = sections[state.testingIndex];
    if (!section) return;

    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    const testData = testOscillatorRef.current;

    // Update waveform
    if (isIsochronic && testData.osc) {
      if (testData.osc.type !== waveform) {
        testData.osc.type = waveform;
      }
      testData.osc.frequency.setValueAtTime(section.carrier, now);
      if (testData.lfo) {
        testData.lfo.frequency.setValueAtTime(section.beat, now);
      }
    } else if (testData.oscL && testData.oscR) {
      if (testData.oscL.type !== waveform) {
        testData.oscL.type = waveform;
        testData.oscR.type = waveform;
      }
      const leftFreq = section.carrier - section.beat / 2;
      const rightFreq = section.carrier + section.beat / 2;
      testData.oscL.frequency.setValueAtTime(leftFreq, now);
      testData.oscR.frequency.setValueAtTime(rightFreq, now);
    }
  }, [sections, state.testingIndex, isIsochronic, waveform]);

  const play = useCallback(
    (fromTime: number = 0) => {
      void (async () => {
        const ok = await ensureAudioRunning();
        if (!ok) return;

        cleanupMainNodes();
        if (!audioCtxRef.current) return;

        // Reset repeat-once flag when starting fresh
        if (fromTime === 0) {
          hasRepeatedOnceRef.current = false;
        }

        startTimeRef.current = fromTime;
        playbackStartRef.current = audioCtxRef.current.currentTime;

        scheduleAllSections(fromTime);

        setState((prev) => ({
          ...prev,
          playbackState: 'playing',
          currentTime: fromTime,
          currentSectionIndex: getCurrentSection(fromTime),
        }));
      })();
    },
    [cleanupMainNodes, ensureAudioRunning, getCurrentSection, scheduleAllSections]
  );

  const stop = useCallback(() => {
    cleanupMainNodes();
    cleanupTestNodes();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setState({
      playbackState: 'stopped',
      currentTime: 0,
      currentSectionIndex: null,
      testingIndex: null,
    });
  }, [cleanupMainNodes, cleanupTestNodes]);

  const pause = useCallback(() => {
    cleanupMainNodes();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setState((prev) => ({ ...prev, playbackState: 'paused' }));
  }, [cleanupMainNodes]);

  const resumeAfterTest = useCallback(() => {
    if (wasPlayingBeforeTestRef.current && pausedTimeRef.current > 0) {
      play(pausedTimeRef.current);
    }
    wasPlayingBeforeTestRef.current = false;
    pausedTimeRef.current = 0;
  }, [play]);

  // Store isIsochronic ref for live mode switching
  const isIsochronicRef = useRef(isIsochronic);
  useEffect(() => {
    isIsochronicRef.current = isIsochronic;
  }, [isIsochronic]);

  // Live mode switching: restart playback when isIsochronic changes during play
  const prevIsIsochronicRef = useRef(isIsochronic);
  useEffect(() => {
    if (prevIsIsochronicRef.current !== isIsochronic) {
      prevIsIsochronicRef.current = isIsochronic;
      
      // If currently playing, restart from current time with new mode
      if (state.playbackState === 'playing' && audioCtxRef.current) {
        const currentPos = state.currentTime;
        cleanupMainNodes();
        
        // Re-schedule all sections with new mode
        startTimeRef.current = currentPos;
        playbackStartRef.current = audioCtxRef.current.currentTime;

        let timeAccumulator = 0;
        sections.forEach((section) => {
          const rampEnabled = getRampEnabled(section);

          if (timeAccumulator + section.duration > currentPos && !section.muted) {
            const sectionStart = Math.max(0, currentPos - timeAccumulator);
            const sectionDuration = section.duration - sectionStart;
            const startOffset = Math.max(0, timeAccumulator - currentPos);

            const progress = sectionStart / section.duration;

            const currentCarrier = rampEnabled && section.endCarrier !== undefined
              ? section.carrier + (section.endCarrier - section.carrier) * progress
              : section.carrier;

            const currentBeat = rampEnabled && section.endBeat !== undefined
              ? section.beat + (section.endBeat - section.beat) * progress
              : section.beat;

            playTone({
              sectionId: section.id,
              carrier: currentCarrier,
              endCarrier: section.endCarrier,
              beat: currentBeat,
              endBeat: section.endBeat,
              rampEnabled,
              duration: sectionDuration,
              volume: section.volume,
              muted: section.muted,
              startOffset,
              isTest: false,
            });
          }
          timeAccumulator += section.duration;
        });
      }
      
      // If testing, restart test with new mode
      if (state.testingIndex !== null) {
        const testIdx = state.testingIndex;
        cleanupTestNodes();
        // Small delay to let cleanup finish
        setTimeout(() => {
          if (testIdx !== null) {
            restartTestWithNewMode(testIdx);
          }
        }, 10);
      }
    }
  }, [isIsochronic, state.playbackState, state.currentTime, state.testingIndex, sections, cleanupMainNodes, getRampEnabled, playTone]);

  // Helper to restart test with current mode
  const restartTestWithNewMode = useCallback(
    (sectionIndex: number) => {
      void (async () => {
        const ok = await ensureAudioRunning();
        if (!ok) return;

        cleanupTestNodes();

        const section = sections[sectionIndex];
        if (!section || !audioCtxRef.current || !masterGainRef.current) return;

        const ctx = audioCtxRef.current;
        const now = ctx.currentTime;
        const duration = 86400;
        const endTime = now + duration;

        const needsFilter = waveformRef.current !== 'sine';

        const sectionGain = ctx.createGain();
        sectionGain.gain.setValueAtTime(section.muted ? 0 : section.volume, now);

      if (isIsochronicRef.current) {
        const osc = ctx.createOscillator();
        osc.type = waveformRef.current;
        osc.frequency.setValueAtTime(section.carrier, now);

        const amp = ctx.createGain();
        amp.gain.value = 0.5;

        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(section.beat, now);

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.5;

        lfo.connect(lfoGain);
        lfoGain.connect(amp.gain);

        if (needsFilter) {
          const filter = createLowPassFilter(ctx);
          osc.connect(filter);
          filter.connect(amp);
          testNodesRef.current.push(filter);
        } else {
          osc.connect(amp);
        }

        amp.connect(sectionGain);
        sectionGain.connect(masterGainRef.current);

        osc.start(now);
        lfo.start(now);
        osc.stop(endTime);
        lfo.stop(endTime);

        testNodesRef.current.push(osc, lfo, amp, lfoGain, sectionGain);
        testOscillatorRef.current = { osc, lfo, sectionIndex };
      } else {
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        oscL.type = waveformRef.current;
        oscR.type = waveformRef.current;

        const panL = ctx.createStereoPanner();
        const panR = ctx.createStereoPanner();
        panL.pan.value = -1;
        panR.pan.value = 1;

        const leftFreq = section.carrier - section.beat / 2;
        const rightFreq = section.carrier + section.beat / 2;
        oscL.frequency.setValueAtTime(leftFreq, now);
        oscR.frequency.setValueAtTime(rightFreq, now);

        if (needsFilter) {
          const filterL = createLowPassFilter(ctx);
          const filterR = createLowPassFilter(ctx);
          oscL.connect(filterL);
          oscR.connect(filterR);
          filterL.connect(panL);
          filterR.connect(panR);
          testNodesRef.current.push(filterL, filterR);
        } else {
          oscL.connect(panL);
          oscR.connect(panR);
        }

        panL.connect(sectionGain);
        panR.connect(sectionGain);
        sectionGain.connect(masterGainRef.current);

        oscL.start(now);
        oscR.start(now);
        oscL.stop(endTime);
        oscR.stop(endTime);

        testNodesRef.current.push(oscL, oscR, panL, panR, sectionGain);
        testOscillatorRef.current = { oscL, oscR, sectionIndex };
      }

        setState((prev) => ({ ...prev, testingIndex: sectionIndex }));
      })();
    },
    [cleanupTestNodes, createLowPassFilter, ensureAudioRunning, sections]
  );

  const testSection = useCallback(
    (sectionIndex: number) => {
      void (async () => {
        const ok = await ensureAudioRunning();
        if (!ok) return;

        // If playing, pause and remember the position
        if (state.playbackState === 'playing') {
          wasPlayingBeforeTestRef.current = true;
          pausedTimeRef.current = state.currentTime;
          cleanupMainNodes();
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        }

        cleanupTestNodes();

        const section = sections[sectionIndex];
        if (!section || !audioCtxRef.current || !masterGainRef.current) return;

        const ctx = audioCtxRef.current;
        const now = ctx.currentTime;
        // Use very long duration (24 hours) - user must manually stop
        const duration = 86400;
        const endTime = now + duration;

        const needsFilter = waveform !== 'sine';

        const sectionGain = ctx.createGain();
        sectionGain.gain.setValueAtTime(section.muted ? 0 : section.volume, now);

      if (isIsochronic) {
        const osc = ctx.createOscillator();
        osc.type = waveform;
        osc.frequency.setValueAtTime(section.carrier, now);

        const amp = ctx.createGain();
        amp.gain.value = 0.5;

        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(section.beat, now);

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.5;

        lfo.connect(lfoGain);
        lfoGain.connect(amp.gain);

        if (needsFilter) {
          const filter = createLowPassFilter(ctx);
          osc.connect(filter);
          filter.connect(amp);
          testNodesRef.current.push(filter);
        } else {
          osc.connect(amp);
        }

        amp.connect(sectionGain);
        sectionGain.connect(masterGainRef.current);

        osc.start(now);
        lfo.start(now);
        osc.stop(endTime);
        lfo.stop(endTime);

        testNodesRef.current.push(osc, lfo, amp, lfoGain, sectionGain);
        testOscillatorRef.current = { osc, lfo, sectionIndex };
      } else {
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        oscL.type = waveform;
        oscR.type = waveform;

        const panL = ctx.createStereoPanner();
        const panR = ctx.createStereoPanner();
        panL.pan.value = -1;
        panR.pan.value = 1;

        const leftFreq = section.carrier - section.beat / 2;
        const rightFreq = section.carrier + section.beat / 2;
        oscL.frequency.setValueAtTime(leftFreq, now);
        oscR.frequency.setValueAtTime(rightFreq, now);

        if (needsFilter) {
          const filterL = createLowPassFilter(ctx);
          const filterR = createLowPassFilter(ctx);
          oscL.connect(filterL);
          oscR.connect(filterR);
          filterL.connect(panL);
          filterR.connect(panR);
          testNodesRef.current.push(filterL, filterR);
        } else {
          oscL.connect(panL);
          oscR.connect(panR);
        }

        panL.connect(sectionGain);
        panR.connect(sectionGain);
        sectionGain.connect(masterGainRef.current);

        oscL.start(now);
        oscR.start(now);
        oscL.stop(endTime);
        oscR.stop(endTime);

        testNodesRef.current.push(oscL, oscR, panL, panR, sectionGain);
        testOscillatorRef.current = { oscL, oscR, sectionIndex };
      }

        setState((prev) => ({ ...prev, testingIndex: sectionIndex, playbackState: 'stopped' }));
      })();
    },
    [cleanupMainNodes, cleanupTestNodes, createLowPassFilter, ensureAudioRunning, isIsochronic, sections, state.currentTime, state.playbackState, waveform]
  );

  const stopTest = useCallback(() => {
    cleanupTestNodes();
    setState((prev) => ({ ...prev, testingIndex: null }));
    resumeAfterTest();
  }, [cleanupTestNodes, resumeAfterTest]);

  const seekTo = useCallback(
    (time: number) => {
      if (state.playbackState === 'playing') {
        play(time);
      } else {
        setState((prev) => ({
          ...prev,
          currentTime: time,
          currentSectionIndex: getCurrentSection(time),
        }));
      }
    },
    [getCurrentSection, play, state.playbackState]
  );

  useEffect(() => {
    return () => {
      cleanupMainNodes();
      cleanupTestNodes();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

      // Note: we do NOT close the AudioContext here because it's shared by the mixer.
      try {
        masterGainRef.current?.disconnect();
      } catch {
        // ignore
      }
    };
  }, [cleanupMainNodes, cleanupTestNodes]);

  return {
    ...state,
    play,
    pause,
    stop,
    testSection,
    stopTest,
    seekTo,
    getTotalDuration,
  };
}
