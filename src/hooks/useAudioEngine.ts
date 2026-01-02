import { useRef, useCallback, useEffect, useState } from 'react';
import { Section, PlaybackState, WaveformType } from '@/types/binaural';

interface AudioEngineState {
  playbackState: PlaybackState;
  currentTime: number;
  currentSectionIndex: number | null;
  testingIndex: number | null;
}

export function useAudioEngine(
  sections: Section[],
  masterVolume: number,
  isIsochronic: boolean,
  waveform: WaveformType = 'sine'
) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const activeNodesRef = useRef<AudioNode[]>([]);
  const testNodesRef = useRef<AudioNode[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const playbackStartRef = useRef<number>(0);
  const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wasPlayingBeforeTestRef = useRef<boolean>(false);
  const pausedTimeRef = useRef<number>(0);
  
  const [state, setState] = useState<AudioEngineState>({
    playbackState: 'stopped',
    currentTime: 0,
    currentSectionIndex: null,
    testingIndex: null,
  });

  // Initialize audio context
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterGainRef.current = audioCtxRef.current.createGain();
      masterGainRef.current.connect(audioCtxRef.current.destination);
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  // Update master volume
  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setValueAtTime(
        masterVolume,
        audioCtxRef.current.currentTime
      );
    }
  }, [masterVolume]);

  // Clean up audio nodes
  const cleanupNodes = useCallback((nodes: AudioNode[]) => {
    nodes.forEach((node) => {
      try {
        if (node instanceof OscillatorNode) {
          node.stop();
        }
        node.disconnect();
      } catch (e) {
        // Node might already be stopped
      }
    });
  }, []);

  const cleanupMainNodes = useCallback(() => {
    cleanupNodes(activeNodesRef.current);
    activeNodesRef.current = [];
  }, [cleanupNodes]);

  const cleanupTestNodes = useCallback(() => {
    cleanupNodes(testNodesRef.current);
    testNodesRef.current = [];
    if (testTimeoutRef.current) {
      clearTimeout(testTimeoutRef.current);
      testTimeoutRef.current = null;
    }
  }, [cleanupNodes]);

  // Create low-pass filter for harsh waveforms
  const createLowPassFilter = useCallback((ctx: AudioContext): BiquadFilterNode => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300; // 200-400Hz range, using 300 as middle ground
    filter.Q.value = 0.7; // Gentle rolloff
    return filter;
  }, []);

  // Play a single tone with optional frequency ramping
  const playTone = useCallback(
    (
      carrier: number,
      endCarrier: number | undefined,
      beat: number,
      endBeat: number | undefined,
      duration: number,
      volume: number,
      startOffset: number = 0,
      isTest: boolean = false
    ) => {
      if (!audioCtxRef.current || !masterGainRef.current) return;

      const ctx = audioCtxRef.current;
      const now = ctx.currentTime + startOffset;
      const endTime = now + duration;

      // Calculate actual end frequencies
      const finalCarrier = endCarrier ?? carrier;
      const finalBeat = endBeat ?? beat;

      // Section gain node
      const sectionGain = ctx.createGain();
      sectionGain.gain.setValueAtTime(volume, now);
      
      const nodesToTrack = isTest ? testNodesRef.current : activeNodesRef.current;
      const needsFilter = waveform !== 'sine';

      if (isIsochronic) {
        // ISOCHRONIC: Carrier + Amplitude Modulation
        const osc = ctx.createOscillator();
        osc.type = waveform;
        osc.frequency.setValueAtTime(carrier, now);
        if (endCarrier !== undefined && endCarrier !== carrier) {
          osc.frequency.linearRampToValueAtTime(finalCarrier, endTime);
        }

        const amp = ctx.createGain();
        amp.gain.value = 0.5;

        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(beat, now);
        if (endBeat !== undefined && endBeat !== beat) {
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
      } else {
        // BINAURAL: Dual Sine with frequency ramping
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        oscL.type = waveform;
        oscR.type = waveform;
        
        const panL = ctx.createStereoPanner();
        const panR = ctx.createStereoPanner();

        panL.pan.value = -1;
        panR.pan.value = 1;

        // Set initial frequencies
        const leftFreqStart = carrier - beat / 2;
        const rightFreqStart = carrier + beat / 2;
        oscL.frequency.setValueAtTime(leftFreqStart, now);
        oscR.frequency.setValueAtTime(rightFreqStart, now);

        // Apply ramping if end frequencies are different
        if ((endCarrier !== undefined && endCarrier !== carrier) || 
            (endBeat !== undefined && endBeat !== beat)) {
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
      }
    },
    [isIsochronic, waveform, createLowPassFilter]
  );

  // Calculate total duration
  const getTotalDuration = useCallback(() => {
    return sections.reduce((acc, section) => acc + section.duration, 0);
  }, [sections]);

  // Get current section based on time
  const getCurrentSection = useCallback(
    (time: number) => {
      let elapsed = 0;
      for (let i = 0; i < sections.length; i++) {
        if (time >= elapsed && time < elapsed + sections[i].duration) {
          return i;
        }
        elapsed += sections[i].duration;
      }
      return null;
    },
    [sections]
  );

  // Animation loop for tracking time
  const updateTime = useCallback(() => {
    if (state.playbackState !== 'playing' || !audioCtxRef.current) return;

    const elapsed = audioCtxRef.current.currentTime - playbackStartRef.current + startTimeRef.current;
    const totalDuration = getTotalDuration();

    if (elapsed >= totalDuration) {
      // Playback finished
      setState((prev) => ({
        ...prev,
        playbackState: 'stopped',
        currentTime: 0,
        currentSectionIndex: null,
      }));
      cleanupMainNodes();
      return;
    }

    const currentIndex = getCurrentSection(elapsed);
    setState((prev) => ({
      ...prev,
      currentTime: elapsed,
      currentSectionIndex: currentIndex,
    }));

    animationFrameRef.current = requestAnimationFrame(updateTime);
  }, [state.playbackState, getTotalDuration, getCurrentSection, cleanupMainNodes]);

  useEffect(() => {
    if (state.playbackState === 'playing') {
      animationFrameRef.current = requestAnimationFrame(updateTime);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state.playbackState, updateTime]);

  // Play full sequence
  const play = useCallback(
    (fromTime: number = 0) => {
      initAudio();
      cleanupMainNodes();

      if (!audioCtxRef.current) return;

      startTimeRef.current = fromTime;
      playbackStartRef.current = audioCtxRef.current.currentTime;

      let timeAccumulator = 0;
      sections.forEach((section) => {
        if (timeAccumulator + section.duration > fromTime && !section.muted) {
          const sectionStart = Math.max(0, fromTime - timeAccumulator);
          const sectionDuration = section.duration - sectionStart;
          const startOffset = Math.max(0, timeAccumulator - fromTime);

          // Calculate ramped values at the current point in the section
          const progress = sectionStart / section.duration;
          const currentCarrier = section.endCarrier !== undefined 
            ? section.carrier + (section.endCarrier - section.carrier) * progress
            : section.carrier;
          const currentBeat = section.endBeat !== undefined
            ? section.beat + (section.endBeat - section.beat) * progress
            : section.beat;

          playTone(
            currentCarrier,
            section.endCarrier,
            currentBeat,
            section.endBeat,
            sectionDuration,
            section.volume,
            startOffset,
            false
          );
        }
        timeAccumulator += section.duration;
      });

      setState((prev) => ({
        ...prev,
        playbackState: 'playing',
        currentTime: fromTime,
        currentSectionIndex: getCurrentSection(fromTime),
      }));
    },
    [sections, initAudio, cleanupMainNodes, playTone, getCurrentSection]
  );

  // Stop playback
  const stop = useCallback(() => {
    cleanupMainNodes();
    cleanupTestNodes();
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setState({
      playbackState: 'stopped',
      currentTime: 0,
      currentSectionIndex: null,
      testingIndex: null,
    });
  }, [cleanupMainNodes, cleanupTestNodes]);

  // Pause playback
  const pause = useCallback(() => {
    cleanupMainNodes();
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setState((prev) => ({
      ...prev,
      playbackState: 'paused',
    }));
  }, [cleanupMainNodes]);

  // Resume playback after test
  const resumeAfterTest = useCallback(() => {
    if (wasPlayingBeforeTestRef.current && pausedTimeRef.current > 0) {
      play(pausedTimeRef.current);
    }
    wasPlayingBeforeTestRef.current = false;
    pausedTimeRef.current = 0;
  }, [play]);

  // Test a single section
  const testSection = useCallback(
    (sectionIndex: number, duration: number = 5) => {
      initAudio();
      
      // Remember if we were playing and pause
      if (state.playbackState === 'playing') {
        wasPlayingBeforeTestRef.current = true;
        pausedTimeRef.current = state.currentTime;
        cleanupMainNodes();
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      }
      
      cleanupTestNodes();

      const section = sections[sectionIndex];
      if (!section) return;

      playTone(
        section.carrier,
        section.endCarrier,
        section.beat,
        section.endBeat,
        duration,
        section.volume,
        0,
        true
      );

      setState((prev) => ({
        ...prev,
        testingIndex: sectionIndex,
      }));

      testTimeoutRef.current = setTimeout(() => {
        cleanupTestNodes();
        setState((prev) => ({
          ...prev,
          testingIndex: null,
        }));
        resumeAfterTest();
      }, duration * 1000);
    },
    [sections, initAudio, cleanupMainNodes, cleanupTestNodes, playTone, state.playbackState, state.currentTime, resumeAfterTest]
  );

  // Stop test manually
  const stopTest = useCallback(() => {
    cleanupTestNodes();
    setState((prev) => ({
      ...prev,
      testingIndex: null,
    }));
    resumeAfterTest();
  }, [cleanupTestNodes, resumeAfterTest]);

  // Seek to time
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
    [state.playbackState, play, getCurrentSection]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMainNodes();
      cleanupTestNodes();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
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
