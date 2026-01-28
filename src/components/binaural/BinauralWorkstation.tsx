import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Section, Track, WaveformType, NoiseSettings, AmbienceSettings, AmbientMusicSettings, EffectsSettings, NoiseType, AmbienceType, AmbientMusicType, LoopMode } from '@/types/binaural';
import { TimelineClip, TimelineTrack } from '@/types/daw';
import { useAudioMixer } from '@/hooks/useAudioMixer';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useNoiseGenerator } from '@/hooks/useNoiseGenerator';
import { useAmbiencePlayer } from '@/hooks/useAmbiencePlayer';
import { useAmbientMusicPlayer } from '@/hooks/useAmbientMusicPlayer';
import { useHistory } from '@/hooks/useHistory';
import { useCustomPresets } from '@/hooks/useCustomPresets';

import { GlobalControls } from './GlobalControls';
import { TransportControls } from './TransportControls';
import { DAWTimeline } from './daw';
import { Timeline } from './Timeline';
import { SectionList } from './SectionList';
import { ImportExport } from './ImportExport';
import { StatusBar } from './StatusBar';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { PresetLibrary, SavePresetDialog } from './PresetLibrary';
import { TriangleGenerator } from './TriangleGenerator';
import { AudioLayersCompact } from './AudioLayersCompact';
import { WaveformSelector } from './WaveformSelector';
import { EffectsRack } from './EffectsRack';
import { ImportExportCompact } from './ImportExportCompact';

import { Button } from '@/components/ui/button';
import { Copy, Trash2, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
const STORAGE_KEY = 'binaural-workstation-track';
const defaultSections: Section[] = [{
  id: 'intro',
  name: 'Intro - Relaxation',
  duration: 60,
  carrier: 100,
  beat: 7.83,
  volume: 0.7,
  muted: false
}, {
  id: 'alpha',
  name: 'Alpha Waves',
  duration: 120,
  carrier: 200,
  beat: 10,
  volume: 0.8,
  muted: false
}, {
  id: 'theta',
  name: 'Deep Theta',
  duration: 180,
  carrier: 180,
  beat: 6,
  volume: 0.8,
  muted: false
}, {
  id: 'gamma',
  name: 'Gamma Focus',
  duration: 90,
  carrier: 220,
  beat: 40,
  volume: 0.75,
  muted: false
}, {
  id: 'outro',
  name: 'Gentle Return',
  duration: 60,
  carrier: 100,
  beat: 14,
  volume: 0.6,
  muted: false
}];
const defaultNoiseSettings: NoiseSettings = {
  type: 'pink',
  volume: 0.3,
  enabled: false
};
const defaultAmbienceSettings: AmbienceSettings = {
  type: 'none',
  volume: 0.4,
  enabled: false
};
const defaultAmbientMusicSettings: AmbientMusicSettings = {
  type: 'soothing',
  volume: 0.35,
  enabled: false
};
const defaultSingleEffects = {
  reverb: {
    enabled: false,
    amount: 0.3
  },
  lowpass: {
    enabled: false,
    frequency: 2000
  },
  autoPan: {
    enabled: false,
    rate: 0.1,
    depth: 0.5
  },
  audio3d: {
    enabled: false,
    intensity: 0.5
  },
  timeshift: {
    enabled: false,
    rate: 1.0
  }
};
const defaultEffectsSettings: EffectsSettings = {
  song: {
    ...defaultSingleEffects
  },
  soundscape: {
    ...defaultSingleEffects
  },
  noise: {
    ...defaultSingleEffects
  },
  ambientMusic: {
    ...defaultSingleEffects
  }
};
const defaultTrack: Track = {
  title: 'My Binaural Session',
  sections: defaultSections,
  masterVolume: 0.5,
  isIsochronic: false,
  bpm: 120,
  waveform: 'sine',
  noise: defaultNoiseSettings,
  ambience: defaultAmbienceSettings,
  ambientMusic: defaultAmbientMusicSettings,
  effects: defaultEffectsSettings
};

// Load saved track from localStorage
const loadSavedTrack = (): Track => {
  const clamp01 = (v: unknown, fallback: number) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    return Math.max(0, Math.min(1, n));
  };
  const isWaveform = (v: unknown): v is WaveformType => v === 'sine' || v === 'triangle' || v === 'sawtooth';
  const isNoiseType = (v: unknown): v is NoiseType => v === 'white' || v === 'pink' || v === 'brown';
  const isAmbienceType = (v: unknown): v is AmbienceType => v === 'none' || v === 'rain' || v === 'forest' || v === 'drone' || v === 'windchimes' || v === 'gongs' || v === 'ocean' || v === 'fan';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.sections && Array.isArray(parsed.sections)) {
        const parsedNoise = parsed.noise ?? {};
        const parsedAmbience = parsed.ambience ?? {};
        const parsedEffects = parsed.effects ?? {};
        const noise: NoiseSettings = {
          type: isNoiseType(parsedNoise.type) ? parsedNoise.type : defaultNoiseSettings.type,
          volume: clamp01(parsedNoise.volume, defaultNoiseSettings.volume),
          enabled: typeof parsedNoise.enabled === 'boolean' ? parsedNoise.enabled : defaultNoiseSettings.enabled
        };
        const ambience: AmbienceSettings = {
          type: isAmbienceType(parsedAmbience.type) ? parsedAmbience.type : defaultAmbienceSettings.type,
          volume: clamp01(parsedAmbience.volume, defaultAmbienceSettings.volume),
          enabled: typeof parsedAmbience.enabled === 'boolean' ? parsedAmbience.enabled : defaultAmbienceSettings.enabled
        };

        // Parse multi-target effects (with backwards compatibility for old single-target format)
        const parseSingleEffects = (src: any, defaults: typeof defaultSingleEffects) => ({
          reverb: {
            enabled: typeof src?.reverb?.enabled === 'boolean' ? src.reverb.enabled : defaults.reverb.enabled,
            amount: clamp01(src?.reverb?.amount, defaults.reverb.amount)
          },
          lowpass: {
            enabled: typeof src?.lowpass?.enabled === 'boolean' ? src.lowpass.enabled : defaults.lowpass.enabled,
            frequency: typeof src?.lowpass?.frequency === 'number' && Number.isFinite(src.lowpass.frequency) ? src.lowpass.frequency : defaults.lowpass.frequency
          },
          autoPan: {
            enabled: typeof src?.autoPan?.enabled === 'boolean' ? src.autoPan.enabled : defaults.autoPan.enabled,
            rate: typeof src?.autoPan?.rate === 'number' && Number.isFinite(src.autoPan.rate) ? src.autoPan.rate : defaults.autoPan.rate,
            depth: clamp01(src?.autoPan?.depth, defaults.autoPan.depth)
          },
          audio3d: {
            enabled: typeof src?.audio3d?.enabled === 'boolean' ? src.audio3d.enabled : defaults.audio3d.enabled,
            intensity: clamp01(src?.audio3d?.intensity, defaults.audio3d.intensity)
          },
          timeshift: {
            enabled: typeof src?.timeshift?.enabled === 'boolean' ? src.timeshift.enabled : defaults.timeshift.enabled,
            rate: typeof src?.timeshift?.rate === 'number' && Number.isFinite(src.timeshift.rate) ? Math.max(0.5, Math.min(5.0, src.timeshift.rate)) : defaults.timeshift.rate
          }
        });

        // Check if it's the new multi-target format or legacy single-target
        const isMultiTarget = parsedEffects?.song || parsedEffects?.soundscape || parsedEffects?.noise;
        const effects: EffectsSettings = isMultiTarget ? {
          song: parseSingleEffects(parsedEffects.song, defaultSingleEffects),
          soundscape: parseSingleEffects(parsedEffects.soundscape, defaultSingleEffects),
          noise: parseSingleEffects(parsedEffects.noise, defaultSingleEffects),
          ambientMusic: parseSingleEffects(parsedEffects.ambientMusic, defaultSingleEffects)
        } : {
          // Migrate legacy format: apply old effects to song only
          song: parseSingleEffects(parsedEffects, defaultSingleEffects),
          soundscape: {
            ...defaultSingleEffects
          },
          noise: {
            ...defaultSingleEffects
          },
          ambientMusic: {
            ...defaultSingleEffects
          }
        };
        return {
          ...defaultTrack,
          ...parsed,
          masterVolume: clamp01(parsed.masterVolume, defaultTrack.masterVolume),
          waveform: isWaveform(parsed.waveform) ? parsed.waveform : defaultTrack.waveform,
          noise,
          ambience,
          effects
        } as Track;
      }
    }
  } catch (e) {
    console.warn('Failed to load saved track:', e);
  }
  return defaultTrack;
};
export function BinauralWorkstation() {
  const {
    state: track,
    set: setTrack,
    undo,
    redo,
    reset: resetTrack,
    canUndo,
    canRedo
  } = useHistory<Track>(loadSavedTrack());
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [activeEditIndex, setActiveEditIndex] = useState<number | null>(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(8);
  const [loopMode, setLoopMode] = useState<LoopMode>('off');
  
  // Timeline clips and tracks state (lifted from DAWTimeline for audio engine)
  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([]);
  const [timelineTracks, setTimelineTracks] = useState<TimelineTrack[]>([]);
  
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
  const [sectionToSave, setSectionToSave] = useState<Section | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Custom presets management
  const {
    presets: customPresets,
    addPreset: addCustomPreset,
    deletePreset: deleteCustomPreset,
    importPresets: importCustomPresets
  } = useCustomPresets();

  // Shared mixer (tones + background layers + FX)
  const mixer = useAudioMixer(track.masterVolume, track.noise.volume, track.ambience.volume, track.ambientMusic.volume, track.effects);

  // Save track to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(track));
    } catch (e) {
      console.warn('Failed to save track:', e);
    }
  }, [track]);
  
  // Handle clips change from DAWTimeline
  const handleClipsChange = useCallback((clips: TimelineClip[], tracks: TimelineTrack[]) => {
    setTimelineClips(clips);
    setTimelineTracks(tracks);
  }, []);
  const {
    playbackState,
    currentTime,
    currentSectionIndex,
    testingIndex,
    play,
    pause,
    stop: engineStop,
    testSection,
    stopTest,
    seekTo,
    getTotalDuration
  } = useAudioEngine(
    track.sections, 
    timelineClips, 
    timelineTracks, 
    track.isIsochronic, 
    track.waveform, 
    mixer.ensure, 
    mixer.getToneInput, 
    loopMode, 
    setLoopMode
  );

  // Wrap stop to also kill reverb tail immediately
  const stop = useCallback(() => {
    engineStop();
    mixer.killAll();
    // Restore mixer volumes after a brief moment so it's ready for next play
    setTimeout(() => mixer.restore(), 50);
  }, [engineStop, mixer]);

  // Background audio layers with preview support (routed into the shared mixer)
  const {
    startPreview: startNoisePreview,
    stopPreview: stopNoisePreview
  } = useNoiseGenerator(mixer.ensure, mixer.getNoiseInput, track.noise.enabled && playbackState === 'playing', track.noise.type);
  const {
    startPreview: startAmbiencePreview,
    stopPreview: stopAmbiencePreview
  } = useAmbiencePlayer(mixer.ensure, mixer.getAmbienceInput, track.ambience.enabled && playbackState === 'playing', track.ambience.type);
  const {
    startPreview: startAmbientMusicPreview,
    stopPreview: stopAmbientMusicPreview
  } = useAmbientMusicPlayer(mixer.ensure, mixer.getAmbientMusicInput, track.ambientMusic.enabled && playbackState === 'playing', track.ambientMusic.type);

  // Preview handlers
  const handlePreviewNoise = useCallback((type: NoiseType) => {
    startNoisePreview(type);
  }, [startNoisePreview]);
  const handleStopPreviewNoise = useCallback(() => {
    stopNoisePreview();
  }, [stopNoisePreview]);
  const handlePreviewAmbience = useCallback((type: AmbienceType) => {
    startAmbiencePreview(type);
  }, [startAmbiencePreview]);
  const handleStopPreviewAmbience = useCallback(() => {
    stopAmbiencePreview();
  }, [stopAmbiencePreview]);
  const handlePreviewAmbientMusic = useCallback((type: AmbientMusicType) => {
    startAmbientMusicPreview(type);
  }, [startAmbientMusicPreview]);
  const handleStopPreviewAmbientMusic = useCallback(() => {
    stopAmbientMusicPreview();
  }, [stopAmbientMusicPreview]);
  const totalDuration = useMemo(() => getTotalDuration(), [getTotalDuration]);

  // Status message
  const statusMessage = useMemo(() => {
    if (testingIndex !== null) {
      return `TESTING: ${track.sections[testingIndex]?.name}`;
    }
    if (playbackState === 'playing' && currentSectionIndex !== null) {
      return `NOW PLAYING: ${track.sections[currentSectionIndex]?.name}`;
    }
    if (playbackState === 'paused') {
      return 'PAUSED';
    }
    return 'SYSTEM READY';
  }, [playbackState, currentSectionIndex, testingIndex, track.sections]);

  // Handlers
  const handleSectionsChange = useCallback((sections: Section[]) => {
    setTrack(prev => ({
      ...prev,
      sections
    }));
  }, [setTrack]);
  const handleVolumeChange = useCallback((masterVolume: number) => {
    setTrack(prev => ({
      ...prev,
      masterVolume
    }));
  }, [setTrack]);
  const handleModeChange = useCallback((isIsochronic: boolean) => {
    setTrack(prev => ({
      ...prev,
      isIsochronic
    }));
  }, [setTrack]);
  const handleTitleChange = useCallback((title: string) => {
    setTrack(prev => ({
      ...prev,
      title
    }));
  }, [setTrack]);
  const handleImport = useCallback((importedTrack: Track) => {
    resetTrack(importedTrack);
    setSelectedIndices(new Set());
  }, [resetTrack]);
  const handlePlay = useCallback(() => {
    mixer.ensure();
    play(currentTime);
  }, [mixer, play, currentTime]);
  const handleTestSection = useCallback((index: number) => {
    testSection(index);
  }, [testSection]);
  const handleSectionClick = useCallback((index: number) => {
    let time = 0;
    for (let i = 0; i < index; i++) {
      time += track.sections[i].duration;
    }
    seekTo(time);
  }, [track.sections, seekTo]);

  // Selection handlers
  const handleToggleSelect = useCallback((index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);
  const handleSelectAll = useCallback(() => {
    setSelectedIndices(new Set(track.sections.map((_, i) => i)));
  }, [track.sections]);
  const handleDeselectAll = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);
  const handleDeleteSelected = useCallback(() => {
    if (selectedIndices.size === 0) {
      toast.error('No sections selected');
      return;
    }
    const remaining = track.sections.filter((_, i) => !selectedIndices.has(i));
    handleSectionsChange(remaining);
    setSelectedIndices(new Set());
    toast.success(`Deleted ${selectedIndices.size} section(s)`);
  }, [selectedIndices, track.sections, handleSectionsChange]);
  const handleDuplicateSelected = useCallback(() => {
    if (selectedIndices.size === 0) {
      toast.error('No sections selected');
      return;
    }
    const indices = Array.from(selectedIndices).sort((a, b) => b - a);
    let newSections = [...track.sections];
    indices.forEach(index => {
      const original = newSections[index];
      const duplicate: Section = {
        ...original,
        id: `${original.id}_copy_${Date.now()}`,
        name: `${original.name} (Copy)`
      };
      newSections.splice(index + 1, 0, duplicate);
    });
    handleSectionsChange(newSections);
    toast.success(`Duplicated ${selectedIndices.size} section(s)`);
  }, [selectedIndices, track.sections, handleSectionsChange]);

  // Navigation
  const handleSkip = useCallback((seconds: number) => {
    seekTo(Math.max(0, Math.min(currentTime + seconds, totalDuration)));
  }, [currentTime, totalDuration, seekTo]);
  const handlePrevSection = useCallback(() => {
    if (currentSectionIndex !== null && currentSectionIndex > 0) {
      handleSectionClick(currentSectionIndex - 1);
    } else {
      seekTo(0);
    }
  }, [currentSectionIndex, handleSectionClick, seekTo]);
  const handleNextSection = useCallback(() => {
    if (currentSectionIndex !== null && currentSectionIndex < track.sections.length - 1) {
      handleSectionClick(currentSectionIndex + 1);
    }
  }, [currentSectionIndex, track.sections.length, handleSectionClick]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setPixelsPerSecond(prev => Math.min(prev * 1.5, 50));
  }, []);
  const handleZoomOut = useCallback(() => {
    setPixelsPerSecond(prev => Math.max(prev / 1.5, 1));
  }, []);

  const handleCycleLoopMode = useCallback(() => {
    const modes: LoopMode[] = ['off', 'repeat-once', 'loop'];
    setLoopMode(prev => {
      const currentIndex = modes.indexOf(prev);
      return modes[(currentIndex + 1) % modes.length];
    });
  }, []);
  const handleFitToView = useCallback(() => {
    if (containerRef.current && totalDuration > 0) {
      const containerWidth = containerRef.current.offsetWidth - 48;
      setPixelsPerSecond(Math.max(1, containerWidth / totalDuration));
    }
  }, [totalDuration]);

  // Add preset
  const handleAddPreset = useCallback((preset: Omit<Section, 'id'>) => {
    const newSection: Section = {
      ...preset,
      id: `preset_${Date.now()}`
    };
    handleSectionsChange([...track.sections, newSection]);
    toast.success(`Added "${preset.name}"`);
  }, [track.sections, handleSectionsChange]);

  // Save section as custom preset (opens dialog for naming)
  const handleSaveAsPreset = useCallback((section: Section) => {
    setSectionToSave(section);
    setSavePresetDialogOpen(true);
  }, []);
  const handleConfirmSavePreset = useCallback((name: string) => {
    if (sectionToSave) {
      addCustomPreset(sectionToSave, name);
      toast.success(`Saved "${name}" to presets`);
      setSectionToSave(null);
    }
  }, [sectionToSave, addCustomPreset]);


  // BPM handler
  const handleBpmChange = useCallback((bpm: number) => {
    setTrack(prev => ({
      ...prev,
      bpm: Math.max(20, Math.min(300, bpm))
    }));
  }, [setTrack]);

  // Waveform handler
  const handleWaveformChange = useCallback((waveform: WaveformType) => {
    setTrack(prev => ({
      ...prev,
      waveform
    }));
  }, [setTrack]);

  // Noise settings handler
  const handleNoiseChange = useCallback((noise: NoiseSettings) => {
    setTrack(prev => ({
      ...prev,
      noise
    }));
  }, [setTrack]);

  // Ambience settings handler
  const handleAmbienceChange = useCallback((ambience: AmbienceSettings) => {
    setTrack(prev => ({
      ...prev,
      ambience
    }));
  }, [setTrack]);

  // Ambient music settings handler
  const handleAmbientMusicChange = useCallback((ambientMusic: AmbientMusicSettings) => {
    setTrack(prev => ({
      ...prev,
      ambientMusic
    }));
  }, [setTrack]);

  // Effects settings handler
  const handleEffectsChange = useCallback((effects: EffectsSettings) => {
    setTrack(prev => ({
      ...prev,
      effects
    }));
  }, [setTrack]);

  // Active section for triangle generator
  const activeSection = activeEditIndex !== null ? track.sections[activeEditIndex] : null;
  const handleGeneratorCarrierChange = useCallback((carrier: number) => {
    if (activeEditIndex === null) return;
    setTrack(prev => {
      const sections = [...prev.sections];
      const s = sections[activeEditIndex];
      if (!s) return prev;
      sections[activeEditIndex] = {
        ...s,
        carrier
      };
      return {
        ...prev,
        sections
      };
    });
  }, [activeEditIndex, setTrack]);
  const handleGeneratorPulseChange = useCallback((pulse: number) => {
    if (activeEditIndex === null) return;
    setTrack(prev => {
      const sections = [...prev.sections];
      const s = sections[activeEditIndex];
      if (!s) return prev;
      sections[activeEditIndex] = {
        ...s,
        beat: pulse
      };
      return {
        ...prev,
        sections
      };
    });
  }, [activeEditIndex, setTrack]);

  // Section edit click handler
  const handleSectionEditClick = useCallback((index: number) => {
    setActiveEditIndex(prev => prev === index ? null : index);
  }, []);
  return <div className="min-h-screen pb-16 md:pb-12" style={{
    background: 'var(--gradient-void)'
  }}>
      {/* Header */}
      <header className="p-3 md:p-6 border-b border-accent/20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Binaural Extension Logo" className="h-8 md:h-12 w-auto" />
            <div>
              <h1 className="text-xs md:text-sm font-light tracking-[0.3em] text-white">
                <span className="italic font-normal lowercase" style={{
                fontFamily: 'Georgia, serif'
              }}>i</span>
                <span className="uppercase">BINAURAL</span>
              </h1>
              <div className="flex items-center gap-2 mt-0.5 md:mt-1">
                <h2 className="text-lg md:text-2xl font-semibold text-white">Beat Lab</h2>
                <span className="text-[8px] md:text-[10px] uppercase tracking-wider px-1.5 md:px-2 py-0.5 bg-accent/20 text-accent border border-accent/50 rounded">
                  Beta
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <TransportControls playbackState={playbackState} currentTime={currentTime} totalDuration={totalDuration} loopMode={loopMode} onLoopModeChange={setLoopMode} onPlay={handlePlay} onPause={pause} onStop={stop} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-3 md:p-6 space-y-4 md:space-y-6" ref={containerRef}>
        {/* Global Controls + Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 md:gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4">
            <GlobalControls masterVolume={track.masterVolume} onVolumeChange={handleVolumeChange} isIsochronic={track.isIsochronic} onModeChange={handleModeChange} />
            {/* Waveform Selector */}
            <WaveformSelector waveform={track.waveform} onWaveformChange={handleWaveformChange} />
          </div>
          <div className="flex items-center gap-0.5 md:gap-1 shrink-0">

            {/* Selection actions */}
            <Button variant="ghost" size="sm" onClick={selectedIndices.size === track.sections.length ? handleDeselectAll : handleSelectAll} className="h-7 md:h-8 px-1.5 md:px-2 text-muted-foreground hover:text-[#000512] hover:bg-accent text-xs">
              {selectedIndices.size === track.sections.length ? <Square className="h-3.5 w-3.5 mr-0.5" /> : <CheckSquare className="h-3.5 w-3.5 mr-0.5" />}
              <span className="hidden sm:inline">{selectedIndices.size > 0 ? `${selectedIndices.size}` : 'All'}</span>
              <span className="sm:hidden">{selectedIndices.size > 0 ? selectedIndices.size : 'All'}</span>
            </Button>

            {selectedIndices.size > 0 && <>
                <Button variant="ghost" size="sm" onClick={handleDuplicateSelected} className="h-7 md:h-8 px-1.5 md:px-2 text-primary hover:text-primary hover:bg-primary/10">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDeleteSelected} className="h-7 md:h-8 px-1.5 md:px-2 text-accent hover:text-accent hover:bg-accent/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>}

            <div className="w-px h-5 bg-border mx-0.5 md:mx-1" />

            <PresetLibrary onAddPreset={handleAddPreset} customPresets={customPresets} onDeleteCustomPreset={deleteCustomPreset} />

            <KeyboardShortcuts isOpen={helpOpen} onOpenChange={setHelpOpen} onPlay={handlePlay} onPause={pause} onStop={stop} onSkip={handleSkip} onNextSection={handleNextSection} onPrevSection={handlePrevSection} onUndo={undo} onRedo={redo} onSelectAll={handleSelectAll} onDeleteSelected={handleDeleteSelected} onDuplicateSelected={handleDuplicateSelected} onDeselectAll={handleDeselectAll} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onCycleLoopMode={handleCycleLoopMode} isPlaying={playbackState === 'playing'} />
          </div>
        </div>

        {/* DAW Timeline */}
        <DAWTimeline 
          sections={track.sections} 
          currentTime={currentTime} 
          currentSectionIndex={currentSectionIndex} 
          pixelsPerSecond={pixelsPerSecond} 
          bpm={track.bpm} 
          loopMode={loopMode} 
          onBpmChange={handleBpmChange} 
          onSeek={seekTo} 
          onZoomIn={handleZoomIn} 
          onZoomOut={handleZoomOut} 
          onFitToView={handleFitToView} 
          canUndo={canUndo} 
          canRedo={canRedo} 
          onUndo={undo} 
          onRedo={redo}
          onSectionsChange={handleSectionsChange}
          onClipsChange={handleClipsChange}
        />

        {/* Section Editor + Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          {/* Mobile: Generator first for quick access */}
          <div className="lg:hidden">
            <TriangleGenerator carrier={activeSection?.carrier ?? 200} pulse={activeSection?.beat ?? 10} onCarrierChange={handleGeneratorCarrierChange} onPulseChange={handleGeneratorPulseChange} disabled={activeEditIndex === null} />
          </div>

          {/* Main Content Area - Sequence Editor */}
          <div className="lg:col-span-8 space-y-4">
            <div className="panel rounded-lg p-3 md:p-4">
              <h3 className="text-xs uppercase tracking-widest font-medium mb-3 md:mb-4 text-slate-400">
                Sequence Library
              </h3>
              <SectionList sections={track.sections} currentSectionIndex={currentSectionIndex} selectedIndices={selectedIndices} activeEditIndex={activeEditIndex} testingIndex={testingIndex} onSectionsChange={handleSectionsChange} onTestSection={handleTestSection} onStopTest={stopTest} onToggleSelect={handleToggleSelect} onEditClick={handleSectionEditClick} onSaveAsPreset={handleSaveAsPreset} />
            </div>

            {/* Effects Rack - Full width below sequence list */}
            <EffectsRack effects={track.effects} onEffectsChange={handleEffectsChange} />
          </div>

          {/* Sidebar - Generator, Layers, Project */}
          <div className="lg:col-span-4 space-y-4">
            {/* Desktop: Triangle Generator */}
            <div className="hidden lg:block">
              <TriangleGenerator carrier={activeSection?.carrier ?? 200} pulse={activeSection?.beat ?? 10} onCarrierChange={handleGeneratorCarrierChange} onPulseChange={handleGeneratorPulseChange} disabled={activeEditIndex === null} />
            </div>
            
            {/* Background Layers - Compact */}
            <AudioLayersCompact noise={track.noise} ambience={track.ambience} ambientMusic={track.ambientMusic} onNoiseChange={handleNoiseChange} onAmbienceChange={handleAmbienceChange} onAmbientMusicChange={handleAmbientMusicChange} onPreviewNoise={handlePreviewNoise} onStopPreviewNoise={handleStopPreviewNoise} onPreviewAmbience={handlePreviewAmbience} onStopPreviewAmbience={handleStopPreviewAmbience} onPreviewAmbientMusic={handlePreviewAmbientMusic} onStopPreviewAmbientMusic={handleStopPreviewAmbientMusic} />
            
            {/* Import/Export - Compact */}
            <ImportExportCompact track={track} onImport={handleImport} onTitleChange={handleTitleChange} customPresets={customPresets} onImportPresets={importCustomPresets} />
          </div>
        </div>
      </main>

      {/* Status Bar */}
      <StatusBar status={statusMessage} playbackState={playbackState} currentTime={currentTime} isIsochronic={track.isIsochronic} />

      {/* Save Preset Dialog */}
      <SavePresetDialog open={savePresetDialogOpen} onOpenChange={setSavePresetDialogOpen} defaultName={sectionToSave?.name || ''} onSave={handleConfirmSavePreset} />

    </div>;
}