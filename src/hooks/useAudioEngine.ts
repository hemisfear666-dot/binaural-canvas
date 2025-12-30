import { useRef, useCallback, useEffect, useState } from 'react';
import { Section, PlaybackState } from '@/types/binaural';

interface AudioEngineState {
  playbackState: PlaybackState;
  currentTime: number;
  currentSectionIndex: number | null;
  testingIndex: number | null;
}

export function useAudioEngine(
  sections: Section[],
  masterVolume: number,
  isIsochronic: boolean
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

  // Play a single tone
  const playTone = useCallback(
    (carrier: number, beat: number, duration: number, volume: number, startOffset: number = 0, isTest: boolean = false) => {
      if (!audioCtxRef.current || !masterGainRef.current) return;

      const ctx = audioCtxRef.current;
      const now = ctx.currentTime + startOffset;

      // Section gain node
      const sectionGain = ctx.createGain();
      sectionGain.gain.setValueAtTime(volume, now);
      sectionGain.connect(masterGainRef.current);

      const nodesToTrack = isTest ? testNodesRef.current : activeNodesRef.current;

      if (isIsochronic) {
        // ISOCHRONIC: Carrier + Amplitude Modulation
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = carrier;

        const amp = ctx.createGain();
        amp.gain.value = 0.5;

        const lfo = ctx.createOscillator();
        lfo.frequency.value = beat;

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.5;

        lfo.connect(lfoGain);
        lfoGain.connect(amp.gain);

        osc.connect(amp);
        amp.connect(sectionGain);

        osc.start(now);
        lfo.start(now);
        osc.stop(now + duration);
        lfo.stop(now + duration);

        nodesToTrack.push(osc, lfo, amp, lfoGain, sectionGain);
      } else {
        // BINAURAL: Dual Sine
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        const panL = ctx.createStereoPanner();
        const panR = ctx.createStereoPanner();

        panL.pan.value = -1;
        panR.pan.value = 1;

        oscL.frequency.value = carrier - beat / 2;
        oscR.frequency.value = carrier + beat / 2;

        oscL.connect(panL);
        panL.connect(sectionGain);
        oscR.connect(panR);
        panR.connect(sectionGain);

        oscL.start(now);
        oscR.start(now);
        oscL.stop(now + duration);
        oscR.stop(now + duration);

        nodesToTrack.push(oscL, oscR, panL, panR, sectionGain);
      }
    },
    [isIsochronic]
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

          playTone(
            section.carrier,
            section.beat,
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

      playTone(section.carrier, section.beat, duration, section.volume, 0, true);

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
