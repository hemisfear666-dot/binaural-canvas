import { useState, useCallback, useMemo, useRef } from 'react';
import { Section, Track } from '@/types/binaural';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useHistory } from '@/hooks/useHistory';
import { GlobalControls } from './GlobalControls';
import { TransportControls } from './TransportControls';
import { Timeline } from './Timeline';
import { SectionList } from './SectionList';
import { ImportExport } from './ImportExport';
import { StatusBar } from './StatusBar';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { PresetLibrary } from './PresetLibrary';
import { Button } from '@/components/ui/button';
import { Undo2, Redo2, Copy, Trash2, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';

const defaultSections: Section[] = [
  { id: 'intro', name: 'Intro - Relaxation', duration: 60, carrier: 100, beat: 7.83, volume: 0.7, muted: false },
  { id: 'alpha', name: 'Alpha Waves', duration: 120, carrier: 200, beat: 10, volume: 0.8, muted: false },
  { id: 'theta', name: 'Deep Theta', duration: 180, carrier: 180, beat: 6, volume: 0.8, muted: false },
  { id: 'gamma', name: 'Gamma Focus', duration: 90, carrier: 220, beat: 40, volume: 0.75, muted: false },
  { id: 'outro', name: 'Gentle Return', duration: 60, carrier: 100, beat: 14, volume: 0.6, muted: false },
];

const defaultTrack: Track = {
  title: 'My Binaural Session',
  sections: defaultSections,
  masterVolume: 0.5,
  isIsochronic: false,
};

export function BinauralWorkstation() {
  const {
    state: track,
    set: setTrack,
    undo,
    redo,
    reset: resetTrack,
    canUndo,
    canRedo,
  } = useHistory<Track>(defaultTrack);

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [helpOpen, setHelpOpen] = useState(false);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(8);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    playbackState,
    currentTime,
    currentSectionIndex,
    play,
    pause,
    stop,
    testSection,
    seekTo,
    getTotalDuration,
  } = useAudioEngine(track.sections, track.masterVolume, track.isIsochronic);

  const totalDuration = useMemo(() => getTotalDuration(), [getTotalDuration]);

  // Status message
  const statusMessage = useMemo(() => {
    if (playbackState === 'playing' && currentSectionIndex !== null) {
      return `NOW PLAYING: ${track.sections[currentSectionIndex]?.name}`;
    }
    if (playbackState === 'paused') {
      return 'PAUSED';
    }
    return 'SYSTEM READY';
  }, [playbackState, currentSectionIndex, track.sections]);

  // Handlers
  const handleSectionsChange = useCallback((sections: Section[]) => {
    setTrack((prev) => ({ ...prev, sections }));
  }, [setTrack]);

  const handleVolumeChange = useCallback((masterVolume: number) => {
    setTrack((prev) => ({ ...prev, masterVolume }));
  }, [setTrack]);

  const handleModeChange = useCallback((isIsochronic: boolean) => {
    setTrack((prev) => ({ ...prev, isIsochronic }));
  }, [setTrack]);

  const handleTitleChange = useCallback((title: string) => {
    setTrack((prev) => ({ ...prev, title }));
  }, [setTrack]);

  const handleImport = useCallback((importedTrack: Track) => {
    resetTrack(importedTrack);
    setSelectedIndices(new Set());
  }, [resetTrack]);

  const handlePlay = useCallback(() => {
    play(currentTime);
  }, [play, currentTime]);

  const handleTestSection = useCallback(
    (index: number) => {
      testSection(index, 5);
    },
    [testSection]
  );

  const handleSectionClick = useCallback((index: number) => {
    let time = 0;
    for (let i = 0; i < index; i++) {
      time += track.sections[i].duration;
    }
    seekTo(time);
  }, [track.sections, seekTo]);

  // Selection handlers
  const handleToggleSelect = useCallback((index: number) => {
    setSelectedIndices((prev) => {
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
    indices.forEach((index) => {
      const original = newSections[index];
      const duplicate: Section = {
        ...original,
        id: `${original.id}_copy_${Date.now()}`,
        name: `${original.name} (Copy)`,
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
    setPixelsPerSecond((prev) => Math.min(prev * 1.5, 50));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPixelsPerSecond((prev) => Math.max(prev / 1.5, 1));
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
      id: `preset_${Date.now()}`,
    };
    handleSectionsChange([...track.sections, newSection]);
    toast.success(`Added "${preset.name}"`);
  }, [track.sections, handleSectionsChange]);

  return (
    <div className="min-h-screen pb-12" style={{ background: 'var(--gradient-void)' }}>
      {/* Keyboard Shortcuts Handler */}
      <KeyboardShortcuts
        isOpen={helpOpen}
        onOpenChange={setHelpOpen}
        onPlay={handlePlay}
        onPause={pause}
        onStop={stop}
        onSkip={handleSkip}
        onNextSection={handleNextSection}
        onPrevSection={handlePrevSection}
        onUndo={undo}
        onRedo={redo}
        onSelectAll={handleSelectAll}
        onDeleteSelected={handleDeleteSelected}
        onDuplicateSelected={handleDuplicateSelected}
        onDeselectAll={handleDeselectAll}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        isPlaying={playbackState === 'playing'}
      />

      {/* Header */}
      <header className="p-6 border-b border-accent/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Binaural Extension Logo" className="h-12 w-auto" />
            <div>
              <h1 className="text-sm font-light uppercase tracking-[0.3em] text-white">
                Binaural Extension
              </h1>
              <h2 className="text-2xl font-semibold text-white mt-1">Beat Lab</h2>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <TransportControls
              playbackState={playbackState}
              currentTime={currentTime}
              totalDuration={totalDuration}
              onPlay={handlePlay}
              onPause={pause}
              onStop={stop}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 space-y-6" ref={containerRef}>
        {/* Global Controls + Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <GlobalControls
            masterVolume={track.masterVolume}
            onVolumeChange={handleVolumeChange}
            isIsochronic={track.isIsochronic}
            onModeChange={handleModeChange}
          />
          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <Button
              variant="ghost"
              size="icon"
              onClick={undo}
              disabled={!canUndo}
              className="text-muted-foreground hover:text-accent hover:bg-accent/10 disabled:opacity-30"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={redo}
              disabled={!canRedo}
              className="text-muted-foreground hover:text-accent hover:bg-accent/10 disabled:opacity-30"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-2" />

            {/* Selection actions */}
            <Button
              variant="ghost"
              size="sm"
              onClick={selectedIndices.size === track.sections.length ? handleDeselectAll : handleSelectAll}
              className="text-muted-foreground hover:text-primary"
            >
              {selectedIndices.size === track.sections.length ? (
                <Square className="h-4 w-4 mr-1" />
              ) : (
                <CheckSquare className="h-4 w-4 mr-1" />
              )}
              {selectedIndices.size > 0 ? `${selectedIndices.size} selected` : 'Select All'}
            </Button>

            {selectedIndices.size > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDuplicateSelected}
                  className="text-primary hover:text-primary hover:bg-primary/10"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Duplicate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteSelected}
                  className="text-accent hover:text-accent hover:bg-accent/10"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </>
            )}

            <div className="w-px h-6 bg-border mx-2" />

            <PresetLibrary onAddPreset={handleAddPreset} />

            <KeyboardShortcuts
              isOpen={helpOpen}
              onOpenChange={setHelpOpen}
              onPlay={handlePlay}
              onPause={pause}
              onStop={stop}
              onSkip={handleSkip}
              onNextSection={handleNextSection}
              onPrevSection={handlePrevSection}
              onUndo={undo}
              onRedo={redo}
              onSelectAll={handleSelectAll}
              onDeleteSelected={handleDeleteSelected}
              onDuplicateSelected={handleDuplicateSelected}
              onDeselectAll={handleDeselectAll}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              isPlaying={playbackState === 'playing'}
            />
          </div>
        </div>

        {/* Timeline Visualization */}
        <Timeline
          sections={track.sections}
          currentTime={currentTime}
          currentSectionIndex={currentSectionIndex}
          pixelsPerSecond={pixelsPerSecond}
          onSeek={seekTo}
          onSectionClick={handleSectionClick}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitToView={handleFitToView}
        />

        {/* Section Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 panel rounded-lg p-4">
            <h3 className="text-xs uppercase tracking-widest text-accent font-medium mb-4">
              Sequence Editor
            </h3>
            <SectionList
              sections={track.sections}
              currentSectionIndex={currentSectionIndex}
              selectedIndices={selectedIndices}
              onSectionsChange={handleSectionsChange}
              onTestSection={handleTestSection}
              onToggleSelect={handleToggleSelect}
            />
          </div>

          <div className="lg:col-span-1">
            <ImportExport
              track={track}
              onImport={handleImport}
              onTitleChange={handleTitleChange}
            />
          </div>
        </div>
      </main>

      {/* Status Bar */}
      <StatusBar
        status={statusMessage}
        playbackState={playbackState}
        currentTime={currentTime}
        isIsochronic={track.isIsochronic}
      />
    </div>
  );
}
