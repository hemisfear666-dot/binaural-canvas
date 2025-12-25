import { useState, useCallback, useMemo } from 'react';
import { Section, Track } from '@/types/binaural';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { GlobalControls } from './GlobalControls';
import { TransportControls } from './TransportControls';
import { Timeline } from './Timeline';
import { SectionList } from './SectionList';
import { ImportExport } from './ImportExport';
import { StatusBar } from './StatusBar';

const defaultSections: Section[] = [
  { id: 'intro', name: 'Intro - Relaxation', duration: 60, carrier: 100, beat: 7.83, volume: 0.7, muted: false },
  { id: 'alpha', name: 'Alpha Waves', duration: 120, carrier: 200, beat: 10, volume: 0.8, muted: false },
  { id: 'theta', name: 'Deep Theta', duration: 180, carrier: 180, beat: 6, volume: 0.8, muted: false },
  { id: 'gamma', name: 'Gamma Focus', duration: 90, carrier: 220, beat: 40, volume: 0.75, muted: false },
  { id: 'outro', name: 'Gentle Return', duration: 60, carrier: 100, beat: 14, volume: 0.6, muted: false },
];

export function BinauralWorkstation() {
  const [track, setTrack] = useState<Track>({
    title: 'My Binaural Session',
    sections: defaultSections,
    masterVolume: 0.5,
    isIsochronic: false,
  });

  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);

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
  }, []);

  const handleVolumeChange = useCallback((masterVolume: number) => {
    setTrack((prev) => ({ ...prev, masterVolume }));
  }, []);

  const handleModeChange = useCallback((isIsochronic: boolean) => {
    setTrack((prev) => ({ ...prev, isIsochronic }));
  }, []);

  const handleTitleChange = useCallback((title: string) => {
    setTrack((prev) => ({ ...prev, title }));
  }, []);

  const handleImport = useCallback((importedTrack: Track) => {
    setTrack(importedTrack);
  }, []);

  const handlePlay = useCallback(() => {
    play(currentTime);
  }, [play, currentTime]);

  const handleTestSection = useCallback(
    (index: number) => {
      setSelectedSectionIndex(index);
      testSection(index, 5);
    },
    [testSection]
  );

  const handleSectionClick = useCallback((index: number) => {
    setSelectedSectionIndex(index);
    // Calculate time at start of section
    let time = 0;
    for (let i = 0; i < index; i++) {
      time += track.sections[i].duration;
    }
    seekTo(time);
  }, [track.sections, seekTo]);

  return (
    <div className="min-h-screen pb-12" style={{ background: 'var(--gradient-void)' }}>
      {/* Header */}
      <header className="p-6 border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-sm font-light uppercase tracking-[0.3em] text-muted-foreground">
              Binaural Extension
            </h1>
            <h2 className="text-2xl font-semibold text-foreground mt-1">Beat Lab</h2>
          </div>
          <TransportControls
            playbackState={playbackState}
            currentTime={currentTime}
            totalDuration={totalDuration}
            onPlay={handlePlay}
            onPause={pause}
            onStop={stop}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Global Controls */}
        <GlobalControls
          masterVolume={track.masterVolume}
          onVolumeChange={handleVolumeChange}
          isIsochronic={track.isIsochronic}
          onModeChange={handleModeChange}
        />

        {/* Timeline Visualization */}
        <Timeline
          sections={track.sections}
          currentTime={currentTime}
          currentSectionIndex={currentSectionIndex}
          pixelsPerSecond={8}
          onSeek={seekTo}
          onSectionClick={handleSectionClick}
        />

        {/* Section Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 panel rounded-lg p-4">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-4">
              Sequence Editor
            </h3>
            <SectionList
              sections={track.sections}
              currentSectionIndex={currentSectionIndex}
              onSectionsChange={handleSectionsChange}
              onTestSection={handleTestSection}
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
