import { useRef, useCallback, useEffect, useState } from 'react';
import { Section, PlaybackState, WaveformType, LoopMode } from '@/types/binaural';
import { TimelineClip, TimelineTrack } from '@/types/daw';
import { ScheduledEvent, generatePlaybackSchedule, getScheduleDuration, getActiveEventsAtTime } from '@/types/playback';
import { resumeAudioContext } from '@/lib/audio/resumeAudioContext';

interface AudioEngineState {
  playbackState: PlaybackState;
  currentTime: number;
  currentSectionIndex: number | null;
  testingIndex: number | null;
}

type GetAudioContext = () => AudioContext;

type ScheduledClipGain = {
  clipId: string;
  gain: GainNode;
  startTime: number;
  endTime: number;
};

export function useAudioEngine(
  sections: Section[],
  clips: TimelineClip[],
  tracks: TimelineTrack[],
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
  const scheduledGainsRef = useRef<ScheduledClipGain[]>([]);

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
      console.warn('[engine] AudioContext not running; user gesture may be required');
    }
    return ok;
  }, [getAudioContext, getOutputNode]);

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

  // Softening filter for harsh waveforms - higher cutoff for more noticeable harmonic content
  const createLowPassFilter = useCallback((ctx: AudioContext, waveformType: WaveformType): BiquadFilterNode => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    // Triangle is softer, allow more harmonics; Sawtooth is brighter, filter more
    filter.frequency.value = waveformType === 'triangle' ? 800 : 500;
    filter.Q.value = 1.2; // Slight resonance for character
    return filter;
  }, []);

  const getRampEnabled = useCallback((section: Section) => {
    const hasTargets = section.endCarrier !== undefined || section.endBeat !== undefined;
    return section.rampEnabled ?? hasTargets;
  }, []);

  // Track active oscillators by clip ID for live updates
  const activeOscillatorsRef = useRef<Map<string, {
    oscL?: OscillatorNode;
    oscR?: OscillatorNode;
    osc?: OscillatorNode;
    lfo?: OscillatorNode;
    filterL?: BiquadFilterNode;
    filterR?: BiquadFilterNode;
    filter?: BiquadFilterNode;
    waveform: WaveformType; // Track waveform for live switching
    endTime: number;
  }>>(new Map());

  // Store waveform ref for test mode live updates (not used for playback anymore)
  const waveformRef = useRef(waveform);
  useEffect(() => {
    waveformRef.current = waveform;
  }, [waveform]);

  const playTone = useCallback(
    (
      opts: {
        clipId: string;
        section: Section;
        duration: number;
        clipWaveform: WaveformType; // Per-clip waveform
        startOffset?: number;
        isTest?: boolean;
      }
    ) => {
      if (!audioCtxRef.current || !masterGainRef.current) return;

      const ctx = audioCtxRef.current;
      const { section, duration, clipId, clipWaveform } = opts;
      const startOffset = opts.startOffset ?? 0;
      const now = ctx.currentTime + startOffset;
      const endTime = now + duration;

      const rampEnabled = getRampEnabled(section);
      const needsFilter = clipWaveform !== 'sine';

      const sectionGain = ctx.createGain();
      sectionGain.gain.setValueAtTime(section.muted ? 0 : section.volume, now);

      const nodesToTrack = opts.isTest ? testNodesRef.current : activeNodesRef.current;
      if (!opts.isTest) {
        scheduledGainsRef.current.push({
          clipId,
          gain: sectionGain,
          startTime: now,
          endTime,
        });
      }

      const finalCarrier = rampEnabled ? (section.endCarrier ?? section.carrier) : section.carrier;
      const finalBeat = rampEnabled ? (section.endBeat ?? section.beat) : section.beat;

      if (isIsochronic) {
        const osc = ctx.createOscillator();
        osc.type = clipWaveform;
        osc.frequency.setValueAtTime(section.carrier, now);
        if (rampEnabled && section.endCarrier !== undefined && section.endCarrier !== section.carrier) {
          osc.frequency.linearRampToValueAtTime(finalCarrier, endTime);
        }

        const amp = ctx.createGain();
        amp.gain.value = 0.5;

        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(section.beat, now);
        if (rampEnabled && section.endBeat !== undefined && section.endBeat !== section.beat) {
          lfo.frequency.linearRampToValueAtTime(finalBeat, endTime);
        }

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.5;

        lfo.connect(lfoGain);
        lfoGain.connect(amp.gain);

        if (needsFilter) {
          const filter = createLowPassFilter(ctx, clipWaveform);
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
        
        if (!opts.isTest) {
          activeOscillatorsRef.current.set(clipId, { osc, lfo, waveform: clipWaveform, endTime });
        }
      } else {
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        oscL.type = clipWaveform;
        oscR.type = clipWaveform;

        const panL = ctx.createStereoPanner();
        const panR = ctx.createStereoPanner();
        panL.pan.value = -1;
        panR.pan.value = 1;

        const leftFreqStart = section.carrier - section.beat / 2;
        const rightFreqStart = section.carrier + section.beat / 2;
        oscL.frequency.setValueAtTime(leftFreqStart, now);
        oscR.frequency.setValueAtTime(rightFreqStart, now);

        if (rampEnabled && ((section.endCarrier !== undefined && section.endCarrier !== section.carrier) || (section.endBeat !== undefined && section.endBeat !== section.beat))) {
          const leftFreqEnd = finalCarrier - finalBeat / 2;
          const rightFreqEnd = finalCarrier + finalBeat / 2;
          oscL.frequency.linearRampToValueAtTime(leftFreqEnd, endTime);
          oscR.frequency.linearRampToValueAtTime(rightFreqEnd, endTime);
        }

        if (needsFilter) {
          const filterL = createLowPassFilter(ctx, clipWaveform);
          const filterR = createLowPassFilter(ctx, clipWaveform);
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
        
        if (!opts.isTest) {
          activeOscillatorsRef.current.set(clipId, { oscL, oscR, waveform: clipWaveform, endTime });
        }
      }
    },
    [createLowPassFilter, getRampEnabled, isIsochronic]
  );

  // Generate playback schedule from clips
  const getPlaybackSchedule = useCallback(() => {
    return generatePlaybackSchedule(clips, tracks, sections);
  }, [clips, tracks, sections]);

  const getTotalDuration = useCallback(() => {
    const schedule = getPlaybackSchedule();
    return getScheduleDuration(schedule);
  }, [getPlaybackSchedule]);

  const getCurrentSection = useCallback(
    (time: number) => {
      const schedule = getPlaybackSchedule();
      const activeEvents = getActiveEventsAtTime(schedule, time);
      if (activeEvents.length === 0) return null;
      
      // Return the section index of the first active event
      const sectionId = activeEvents[0].sectionId;
      return sections.findIndex(s => s.id === sectionId);
    },
    [getPlaybackSchedule, sections]
  );

  // Ref for loop mode to avoid stale closures
  const loopModeRef = useRef(loopMode);
  useEffect(() => {
    loopModeRef.current = loopMode;
  }, [loopMode]);

  // Track if we've done the repeat-once replay
  const hasRepeatedOnceRef = useRef(false);

  // Schedule all clips from a given time
  const scheduleAllClips = useCallback((fromTime: number) => {
    if (!audioCtxRef.current) return;

    const schedule = getPlaybackSchedule();
    
    for (const event of schedule) {
      const clipEnd = event.startTime + event.duration;
      
      // Skip clips that have already finished
      if (clipEnd <= fromTime) continue;
      
      // Calculate how much of this clip we need to play
      const clipStartOffset = Math.max(0, fromTime - event.startTime);
      const remainingDuration = event.duration - clipStartOffset;
      const startOffset = Math.max(0, event.startTime - fromTime);
      
      // Calculate progress for ramping
      const progress = clipStartOffset / event.duration;
      const rampEnabled = getRampEnabled(event.section);
      
      // Create a modified section with current progress values
      const currentCarrier = rampEnabled && event.section.endCarrier !== undefined
        ? event.section.carrier + (event.section.endCarrier - event.section.carrier) * progress
        : event.section.carrier;

      const currentBeat = rampEnabled && event.section.endBeat !== undefined
        ? event.section.beat + (event.section.endBeat - event.section.beat) * progress
        : event.section.beat;

      const adjustedSection: Section = {
        ...event.section,
        carrier: currentCarrier,
        beat: currentBeat,
      };

      playTone({
        clipId: event.clipId,
        section: adjustedSection,
        duration: remainingDuration,
        clipWaveform: event.waveform,
        startOffset,
        isTest: false,
      });
    }
  }, [getPlaybackSchedule, getRampEnabled, playTone]);

  // Keep a ref to scheduleAllClips so updateTime always has the latest version
  const scheduleAllClipsRef = useRef(scheduleAllClips);
  useEffect(() => {
    scheduleAllClipsRef.current = scheduleAllClips;
  }, [scheduleAllClips]);

  const updateTime = useCallback(() => {
    if (state.playbackState !== 'playing' || !audioCtxRef.current) return;

    const elapsed = audioCtxRef.current.currentTime - playbackStartRef.current + startTimeRef.current;
    const totalDuration = getTotalDuration();

    if (elapsed >= totalDuration) {
      const currentLoopMode = loopModeRef.current;

      if (currentLoopMode === 'loop') {
        cleanupMainNodes();
        startTimeRef.current = 0;
        playbackStartRef.current = audioCtxRef.current.currentTime;
        scheduleAllClipsRef.current(0);
        setState((prev) => ({
          ...prev,
          currentTime: 0,
          currentSectionIndex: getCurrentSection(0),
        }));
        animationFrameRef.current = requestAnimationFrame(updateTime);
        return;
      } else if (currentLoopMode === 'repeat-once' && !hasRepeatedOnceRef.current) {
        hasRepeatedOnceRef.current = true;
        cleanupMainNodes();
        startTimeRef.current = 0;
        playbackStartRef.current = audioCtxRef.current.currentTime;
        scheduleAllClipsRef.current(0);
        setState((prev) => ({
          ...prev,
          currentTime: 0,
          currentSectionIndex: getCurrentSection(0),
        }));
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

  // Live per-clip volume/mute updates while playing
  useEffect(() => {
    if (state.playbackState !== 'playing' || !audioCtxRef.current) return;

    const ctx = audioCtxRef.current;
    const sectionMap = new Map(sections.map((s) => [s.id, s] as const));
    const clipMap = new Map(clips.map((c) => [c.id, c] as const));

    for (const scheduled of scheduledGainsRef.current) {
      const clip = clipMap.get(scheduled.clipId);
      if (!clip) continue;
      const section = sectionMap.get(clip.sectionId);
      if (!section) continue;
      
      const t = ctx.currentTime;
      if (t < scheduled.startTime || t > scheduled.endTime) continue;
      
      const isMuted = clip.muted || section.muted;
      scheduled.gain.gain.setValueAtTime(isMuted ? 0 : section.volume, t);
    }
  }, [sections, clips, state.playbackState]);

  // Live waveform switching: restart clips when their waveform changes during playback
  const prevClipsWaveformRef = useRef<Map<string, WaveformType>>(new Map());
  useEffect(() => {
    if (state.playbackState !== 'playing' || !audioCtxRef.current) {
      prevClipsWaveformRef.current.clear();
      return;
    }

    const ctx = audioCtxRef.current;
    const currentTime = state.currentTime;
    const clipMap = new Map(clips.map((c) => [c.id, c] as const));
    const sectionMap = new Map(sections.map((s) => [s.id, s] as const));

    // Check each active oscillator for waveform changes
    for (const [clipId, oscData] of activeOscillatorsRef.current) {
      const clip = clipMap.get(clipId);
      if (!clip) continue;

      const prevWaveform = prevClipsWaveformRef.current.get(clipId);
      
      // If waveform changed, restart this clip
      if (prevWaveform !== undefined && prevWaveform !== clip.waveform) {
        const section = sectionMap.get(clip.sectionId);
        if (!section) continue;

        // Stop the old oscillators
        try {
          if (oscData.osc) oscData.osc.stop();
          if (oscData.oscL) oscData.oscL.stop();
          if (oscData.oscR) oscData.oscR.stop();
          if (oscData.lfo) oscData.lfo.stop();
        } catch {
          // Ignore - might already be stopped
        }

        // Calculate remaining time for this clip
        const clipEnd = clip.startTime + clip.duration;
        const elapsedInClip = currentTime - clip.startTime;
        const remainingDuration = clipEnd - currentTime;

        if (remainingDuration > 0 && currentTime >= clip.startTime) {
          // Calculate current frequency values if ramping
          const progress = elapsedInClip / clip.duration;
          const rampEnabled = section.rampEnabled ?? (section.endCarrier !== undefined || section.endBeat !== undefined);
          
          const currentCarrier = rampEnabled && section.endCarrier !== undefined
            ? section.carrier + (section.endCarrier - section.carrier) * progress
            : section.carrier;

          const currentBeat = rampEnabled && section.endBeat !== undefined
            ? section.beat + (section.endBeat - section.beat) * progress
            : section.beat;

          const adjustedSection: Section = {
            ...section,
            carrier: currentCarrier,
            beat: currentBeat,
          };

          // Play with new waveform
          playTone({
            clipId,
            section: adjustedSection,
            duration: remainingDuration,
            clipWaveform: clip.waveform,
            startOffset: 0,
            isTest: false,
          });
        }
      }
    }

    // Update previous waveform map
    prevClipsWaveformRef.current.clear();
    for (const clip of clips) {
      prevClipsWaveformRef.current.set(clip.id, clip.waveform);
    }
  }, [clips, sections, state.playbackState, state.currentTime, playTone]);

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

        scheduleAllClips(fromTime);

        setState((prev) => ({
          ...prev,
          playbackState: 'playing',
          currentTime: fromTime,
          currentSectionIndex: getCurrentSection(fromTime),
        }));
      })();
    },
    [cleanupMainNodes, ensureAudioRunning, getCurrentSection, scheduleAllClips]
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
      
      if (state.playbackState === 'playing' && audioCtxRef.current) {
        const currentPos = state.currentTime;
        cleanupMainNodes();
        
        startTimeRef.current = currentPos;
        playbackStartRef.current = audioCtxRef.current.currentTime;
        scheduleAllClips(currentPos);
      }
      
      if (state.testingIndex !== null) {
        const testIdx = state.testingIndex;
        cleanupTestNodes();
        setTimeout(() => {
          if (testIdx !== null) {
            restartTestWithNewMode(testIdx);
          }
        }, 10);
      }
    }
  }, [isIsochronic, state.playbackState, state.currentTime, state.testingIndex, cleanupMainNodes, scheduleAllClips, cleanupTestNodes]);

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
            const filter = createLowPassFilter(ctx, waveformRef.current);
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
            const filterL = createLowPassFilter(ctx, waveformRef.current);
            const filterR = createLowPassFilter(ctx, waveformRef.current);
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
            const filter = createLowPassFilter(ctx, waveform);
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
            const filterL = createLowPassFilter(ctx, waveform);
            const filterR = createLowPassFilter(ctx, waveform);
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

  // Live update test oscillator when section frequencies change
  useEffect(() => {
    if (state.testingIndex === null || !testOscillatorRef.current || !audioCtxRef.current) return;

    const section = sections[state.testingIndex];
    if (!section) return;

    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    const testData = testOscillatorRef.current;

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

  useEffect(() => {
    return () => {
      cleanupMainNodes();
      cleanupTestNodes();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

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
