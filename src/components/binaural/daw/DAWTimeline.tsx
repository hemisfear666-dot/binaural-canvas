import { 
  useRef, 
  useState, 
  useCallback, 
  useMemo, 
  useEffect,
  memo,
} from 'react';
import { 
  TimelineTrack, 
  TimelineClip, 
  TRACK_COLORS, 
  ClipContextAction,
} from '@/types/daw';
import { Section, LoopMode } from '@/types/binaural';
import { TimelineTrackRow } from './TimelineTrack';
import { TimelineContextMenu } from './TimelineContextMenu';
import { TimelineFooter } from './TimelineFooter';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

interface DAWTimelineProps {
  sections: Section[];
  currentTime: number;
  currentSectionIndex: number | null;
  pixelsPerSecond: number;
  bpm: number;
  loopMode?: LoopMode;
  canUndo?: boolean;
  canRedo?: boolean;
  onBpmChange: (bpm: number) => void;
  onSeek: (time: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSectionsChange: (sections: Section[]) => void;
  onClipsChange?: (clips: TimelineClip[], tracks: TimelineTrack[]) => void;
  onSelectedClipsChange?: (selectedClipIds: Set<string>) => void;
  deleteSelectedClipsRef?: React.MutableRefObject<(() => void) | null>;
}

// Generate unique ID
const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Convert legacy sections to DAW format
const initializeFromSections = (sections: Section[]): { tracks: TimelineTrack[]; clips: TimelineClip[] } => {
  // Create a single track with all sections as sequential clips
  const track: TimelineTrack = {
    id: 'track_1',
    name: 'Track 1',
    color: TRACK_COLORS[0],
    muted: false,
    solo: false,
    volume: 1,
  };

  let currentTime = 0;
  const clips: TimelineClip[] = sections.map((section) => {
    const clip: TimelineClip = {
      id: `clip_${section.id}`,
      sectionId: section.id,
      trackId: track.id,
      startTime: currentTime,
      duration: section.duration,
      muted: section.muted,
      waveform: 'sine', // Default waveform
    };
    currentTime += section.duration;
    return clip;
  });

  return { tracks: [track], clips };
};

export const DAWTimeline = memo(function DAWTimeline({
  sections,
  currentTime,
  currentSectionIndex,
  pixelsPerSecond,
  bpm,
  loopMode = 'off',
  canUndo = false,
  canRedo = false,
  onBpmChange,
  onSeek,
  onZoomIn,
  onZoomOut,
  onFitToView,
  onUndo,
  onRedo,
  onSectionsChange,
  onClipsChange,
  onSelectedClipsChange,
  deleteSelectedClipsRef,
}: DAWTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tracksContainerRef = useRef<HTMLDivElement>(null);
  
  // BPM input state
  const bpmInputRef = useRef<HTMLInputElement>(null);
  const [bpmFocused, setBpmFocused] = useState(false);
  const [localBpm, setLocalBpm] = useState(String(bpm));

  // DAW state
  const [tracks, setTracks] = useState<TimelineTrack[]>([]);
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(1); // 1 second default

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    clipId: string;
  } | null>(null);

  // Drag state for drop zones
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);
  const [dragOverNewTrack, setDragOverNewTrack] = useState(false);
  const [dropTime, setDropTime] = useState<number>(0);

  // Initialize from sections
  useEffect(() => {
    const { tracks: initialTracks, clips: initialClips } = initializeFromSections(sections);
    setTracks(initialTracks);
    setClips(initialClips);
  }, []); // Only on mount

  // Notify parent when clips or tracks change
  useEffect(() => {
    onClipsChange?.(clips, tracks);
  }, [clips, tracks, onClipsChange]);

  // Notify parent when selection changes
  useEffect(() => {
    onSelectedClipsChange?.(selectedClipIds);
  }, [selectedClipIds, onSelectedClipsChange]);

  // Delete selected clips function - exposed via ref
  const deleteSelectedClips = useCallback(() => {
    if (selectedClipIds.size === 0) {
      toast.error('No clips selected');
      return;
    }
    setClips(prev => prev.filter(c => !selectedClipIds.has(c.id)));
    toast.success(`Deleted ${selectedClipIds.size} clip(s)`);
    setSelectedClipIds(new Set());
  }, [selectedClipIds]);

  // Expose delete function via ref
  useEffect(() => {
    if (deleteSelectedClipsRef) {
      deleteSelectedClipsRef.current = deleteSelectedClips;
    }
    return () => {
      if (deleteSelectedClipsRef) {
        deleteSelectedClipsRef.current = null;
      }
    };
  }, [deleteSelectedClips, deleteSelectedClipsRef]);

  // Sync BPM input
  useEffect(() => {
    if (!bpmFocused) {
      setLocalBpm(String(bpm));
    }
  }, [bpm, bpmFocused]);

  // Scroll wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Only zoom if hovering over timeline area (not inputs)
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT') return;
      
      // Check if we're inside the timeline
      if (!container.contains(target)) return;

      // Ctrl+wheel or just wheel when focused on timeline
      if (e.ctrlKey || e.metaKey || container.matches(':hover')) {
        e.preventDefault();
        if (e.deltaY < 0) {
          onZoomIn();
        } else {
          onZoomOut();
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [onZoomIn, onZoomOut]);

  // Calculate total duration from clips
  const totalDuration = useMemo(() => {
    if (clips.length === 0) return 60; // Default 60 seconds
    return Math.max(...clips.map(c => c.startTime + c.duration));
  }, [clips]);

  const totalWidth = Math.max(totalDuration * pixelsPerSecond, 800);

  // Generate grid lines
  const gridLines = useMemo(() => {
    if (!showGrid) return [];
    const lines: number[] = [];
    for (let t = 0; t <= totalDuration + gridSize; t += gridSize) {
      lines.push(t);
    }
    return lines;
  }, [totalDuration, gridSize, showGrid]);

  // Time markers for ruler
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const interval = totalDuration > 300 ? 60 : totalDuration > 60 ? 10 : 5;
    for (let t = 0; t <= totalDuration; t += interval) {
      markers.push(t);
    }
    return markers;
  }, [totalDuration]);

  // Format time for markers
  const formatMarkerTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Snap time to grid
  const snapToGrid = useCallback((time: number) => {
    if (!snapEnabled) return time;
    return Math.round(time / gridSize) * gridSize;
  }, [snapEnabled, gridSize]);

  // Find which clip is playing
  const playingClipId = useMemo(() => {
    const clip = clips.find(c => {
      const clipEnd = c.startTime + c.duration;
      return currentTime >= c.startTime && currentTime < clipEnd;
    });
    return clip?.id || null;
  }, [clips, currentTime]);

  // BPM handlers
  const handleBpmBlur = useCallback(() => {
    setBpmFocused(false);
    const parsed = parseInt(localBpm, 10);
    if (Number.isFinite(parsed)) {
      onBpmChange(Math.max(20, Math.min(300, parsed)));
    } else {
      setLocalBpm(String(bpm));
    }
  }, [localBpm, bpm, onBpmChange]);

  // Click on timeline to seek
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-clip]')) return; // Don't seek when clicking clips
    
    if (!tracksContainerRef.current) return;
    const rect = tracksContainerRef.current.getBoundingClientRect();
    // Account for track header width (160px = w-40)
    const x = e.clientX - rect.left - 160;
    if (x < 0) return; // Clicked on track header
    
    const time = Math.max(0, Math.min(x / pixelsPerSecond, totalDuration));
    onSeek(snapToGrid(time));
  }, [pixelsPerSecond, totalDuration, onSeek, snapToGrid]);

  // Calculate drop time from mouse position
  const calculateDropTime = useCallback((e: React.DragEvent, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return snapToGrid(Math.max(0, x / pixelsPerSecond));
  }, [pixelsPerSecond, snapToGrid]);

  // Handle drag over track
  const handleTrackDragOver = useCallback((e: React.DragEvent, trackId: string, trackElement: HTMLElement) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    
    // Check if it's a section being dragged
    if (e.dataTransfer.types.includes('application/section-id')) {
      setDragOverTrackId(trackId);
      setDragOverNewTrack(false);
      setDropTime(calculateDropTime(e, trackElement));
    }
  }, [calculateDropTime]);

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setDragOverTrackId(null);
    setDragOverNewTrack(false);
  }, []);

  // Handle drop on track
  const handleTrackDrop = useCallback((e: React.DragEvent, trackId: string, trackElement: HTMLElement) => {
    e.preventDefault();
    
    const sectionId = e.dataTransfer.getData('application/section-id');
    const sectionJson = e.dataTransfer.getData('application/section-json');
    
    if (!sectionId || !sectionJson) {
      setDragOverTrackId(null);
      return;
    }

    try {
      const section = JSON.parse(sectionJson) as Section;
      const time = calculateDropTime(e, trackElement);
      
      // Create new clip
      const newClip: TimelineClip = {
        id: generateId(),
        sectionId: section.id,
        trackId: trackId,
        startTime: time,
        duration: section.duration,
        muted: section.muted,
        waveform: 'sine', // Default waveform
      };
      
      setClips(prev => [...prev, newClip]);
      toast.success(`Added "${section.name}" to timeline`);
    } catch (err) {
      console.error('Failed to parse dropped section:', err);
    }
    
    setDragOverTrackId(null);
    setDragOverNewTrack(false);
  }, [calculateDropTime]);

  // Handle drag over new track zone
  const handleNewTrackDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    
    if (e.dataTransfer.types.includes('application/section-id')) {
      setDragOverNewTrack(true);
      setDragOverTrackId(null);
    }
  }, []);

  // Handle drop on new track zone
  const handleNewTrackDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    const sectionId = e.dataTransfer.getData('application/section-id');
    const sectionJson = e.dataTransfer.getData('application/section-json');
    
    if (!sectionId || !sectionJson) {
      setDragOverNewTrack(false);
      return;
    }

    try {
      const section = JSON.parse(sectionJson) as Section;
      
      // Create new track
      const colorIndex = tracks.length % TRACK_COLORS.length;
      const newTrack: TimelineTrack = {
        id: generateId(),
        name: `Track ${tracks.length + 1}`,
        color: TRACK_COLORS[colorIndex],
        muted: false,
        solo: false,
        volume: 1,
      };
      
      // Create clip at start of new track
      const newClip: TimelineClip = {
        id: generateId(),
        sectionId: section.id,
        trackId: newTrack.id,
        startTime: 0,
        duration: section.duration,
        muted: section.muted,
        waveform: 'sine', // Default waveform
      };
      
      setTracks(prev => [...prev, newTrack]);
      setClips(prev => [...prev, newClip]);
      toast.success(`Created new track with "${section.name}"`);
    } catch (err) {
      console.error('Failed to parse dropped section:', err);
    }
    
    setDragOverNewTrack(false);
  }, [tracks.length]);

  // Track operations
  const handleAddTrack = useCallback(() => {
    const colorIndex = tracks.length % TRACK_COLORS.length;
    const newTrack: TimelineTrack = {
      id: generateId(),
      name: `Track ${tracks.length + 1}`,
      color: TRACK_COLORS[colorIndex],
      muted: false,
      solo: false,
      volume: 1,
    };
    setTracks(prev => [...prev, newTrack]);
    toast.success('Track added');
  }, [tracks.length]);

  const handleTrackUpdate = useCallback((trackId: string, updates: Partial<TimelineTrack>) => {
    setTracks(prev => prev.map(t => 
      t.id === trackId ? { ...t, ...updates } : t
    ));
  }, []);

  const handleTrackDelete = useCallback((trackId: string) => {
    if (tracks.length <= 1) {
      toast.error('Cannot delete the last track');
      return;
    }
    setTracks(prev => prev.filter(t => t.id !== trackId));
    setClips(prev => prev.filter(c => c.trackId !== trackId));
    toast.success('Track deleted');
  }, [tracks.length]);

  // Track click - place section at cursor position
  const handleTrackClick = useCallback((trackId: string, time: number) => {
    onSeek(snapToGrid(time));
  }, [onSeek, snapToGrid]);

  // Clip operations
  const handleClipSelect = useCallback((clipId: string, additive: boolean) => {
    setSelectedClipIds(prev => {
      if (additive) {
        const next = new Set(prev);
        if (next.has(clipId)) {
          next.delete(clipId);
        } else {
          next.add(clipId);
        }
        return next;
      }
      return new Set([clipId]);
    });
  }, []);

  const handleClipMove = useCallback((clipId: string, newStartTime: number, newTrackId?: string) => {
    setClips(prev => prev.map(c => 
      c.id === clipId 
        ? { ...c, startTime: Math.max(0, newStartTime), ...(newTrackId ? { trackId: newTrackId } : {}) }
        : c
    ));
  }, []);

  const handleClipResize = useCallback((clipId: string, newDuration: number, edge: 'start' | 'end') => {
    setClips(prev => prev.map(c => 
      c.id === clipId ? { ...c, duration: Math.max(0.5, newDuration) } : c
    ));
  }, []);

  const handleClipContextMenu = useCallback((e: React.MouseEvent, clipId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, clipId });
  }, []);

  const handleClipDoubleClick = useCallback((clipId: string) => {
    toast.info('Double-click to edit (coming soon)');
  }, []);

  const handleContextMenuAction = useCallback((action: ClipContextAction, clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    switch (action) {
      case 'mute':
        setClips(prev => prev.map(c => 
          c.id === clipId ? { ...c, muted: true } : c
        ));
        toast.success('Clip muted');
        break;
      case 'unmute':
        setClips(prev => prev.map(c => 
          c.id === clipId ? { ...c, muted: false } : c
        ));
        toast.success('Clip unmuted');
        break;
      case 'set-waveform-sine':
        setClips(prev => prev.map(c => 
          c.id === clipId ? { ...c, waveform: 'sine' } : c
        ));
        toast.success('Waveform set to Sine');
        break;
      case 'set-waveform-triangle':
        setClips(prev => prev.map(c => 
          c.id === clipId ? { ...c, waveform: 'triangle' } : c
        ));
        toast.success('Waveform set to Triangle');
        break;
      case 'set-waveform-sawtooth':
        setClips(prev => prev.map(c => 
          c.id === clipId ? { ...c, waveform: 'sawtooth' } : c
        ));
        toast.success('Waveform set to Sawtooth');
        break;
      case 'duplicate':
        const newClip: TimelineClip = {
          ...clip,
          id: generateId(),
          startTime: clip.startTime + clip.duration,
        };
        setClips(prev => [...prev, newClip]);
        toast.success('Clip duplicated');
        break;
      case 'delete':
        setClips(prev => prev.filter(c => c.id !== clipId));
        setSelectedClipIds(prev => {
          const next = new Set(prev);
          next.delete(clipId);
          return next;
        });
        toast.success('Clip deleted');
        break;
      case 'reset-duration':
        const section = sections.find(s => s.id === clip.sectionId);
        if (section) {
          setClips(prev => prev.map(c => 
            c.id === clipId ? { ...c, duration: section.duration } : c
          ));
          toast.success('Duration reset');
        }
        break;
      case 'split':
        toast.info('Split at cursor (coming soon)');
        break;
      case 'trim-start':
      case 'trim-end':
        toast.info('Trim (coming soon)');
        break;
    }
  }, [clips, sections]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`panel rounded-lg overflow-hidden transition-all duration-300 ${loopMode === 'loop' ? 'loop-glow' : ''}`}
    >
      {/* Header with BPM and label */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-void-surface gap-2">
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium shrink-0">
          Timeline
        </span>
        <div className="flex items-center gap-2">
          {/* BPM Control */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">BPM</span>
            <Input
              ref={bpmInputRef}
              type="text"
              inputMode="numeric"
              value={localBpm}
              onChange={(e) => setLocalBpm(e.target.value)}
              onFocus={() => setBpmFocused(true)}
              onBlur={handleBpmBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') bpmInputRef.current?.blur();
              }}
              className="h-6 w-[4.5rem] bg-void border-border text-center font-mono text-xs"
            />
          </div>
        </div>
      </div>

      {/* Main timeline area */}
      <div className="flex flex-col relative">
        {/* Time ruler */}
        <div className="flex border-b border-border">
          {/* Track header spacer */}
          <div className="w-40 shrink-0 border-r border-border bg-void-surface" />
          
          {/* Ruler */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 h-6 bg-void-surface relative overflow-x-auto scrollbar-hide"
          >
            <div style={{ width: totalWidth }} className="h-full relative">
              {timeMarkers.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 h-full flex flex-col justify-end"
                  style={{ left: t * pixelsPerSecond }}
                >
                  <div className="h-2 w-px bg-muted-foreground/30" />
                  <span className="text-[10px] font-mono text-muted-foreground ml-1">
                    {formatMarkerTime(t)}
                  </span>
                </div>
              ))}
              
              {/* Playhead on ruler */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-accent z-20"
                style={{ left: currentTime * pixelsPerSecond }}
              />
            </div>
          </div>
        </div>

        {/* Tracks */}
        <div 
          ref={tracksContainerRef}
          className="max-h-[400px] overflow-y-auto overflow-x-hidden relative"
          onClick={handleTimelineClick}
        >
          <div className="overflow-x-auto">
            {tracks.map((track) => (
              <TimelineTrackRow
                key={track.id}
                track={track}
                clips={clips.filter(c => c.trackId === track.id)}
                sections={sections}
                pixelsPerSecond={pixelsPerSecond}
                totalWidth={totalWidth}
                selectedClipIds={selectedClipIds}
                playingClipId={playingClipId}
                gridLines={gridLines}
                onTrackUpdate={handleTrackUpdate}
                onTrackDelete={handleTrackDelete}
                onClipSelect={handleClipSelect}
                onClipMove={handleClipMove}
                onClipResize={handleClipResize}
                onClipContextMenu={handleClipContextMenu}
                onClipDoubleClick={handleClipDoubleClick}
                onTrackClick={handleTrackClick}
                snapToGrid={snapToGrid}
                isDragOver={dragOverTrackId === track.id}
                dropTime={dropTime}
                onDragOver={handleTrackDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleTrackDrop}
              />
            ))}
            
            {/* Drop zone for new track */}
            <div
              className={`
                flex items-center justify-center h-14 border-2 border-dashed transition-all
                ${dragOverNewTrack 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border/30 hover:border-border/50'
                }
              `}
              onDragOver={handleNewTrackDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleNewTrackDrop}
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Plus className="h-4 w-4" />
                <span className="text-xs">Drop here to create new track</span>
              </div>
            </div>
          </div>

          {/* Playhead line across all tracks */}
          <div
            className="absolute top-0 bottom-0 w-0.5 pointer-events-none z-30"
            style={{ 
              left: `calc(10rem + ${currentTime * pixelsPerSecond}px)`,
              background: 'linear-gradient(180deg, hsl(var(--accent)) 0%, hsl(var(--primary)) 100%)',
              boxShadow: '0 0 10px hsl(var(--accent)), 0 0 20px hsl(var(--accent) / 0.5)',
            }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-accent rounded-full shadow-lg" />
          </div>
        </div>
      </div>

      {/* Footer */}
      <TimelineFooter
        snapEnabled={snapEnabled}
        gridSize={gridSize}
        showGrid={showGrid}
        bpm={bpm}
        pixelsPerSecond={pixelsPerSecond}
        canUndo={canUndo}
        canRedo={canRedo}
        onSnapToggle={() => setSnapEnabled(prev => !prev)}
        onGridSizeChange={setGridSize}
        onGridVisibilityToggle={() => setShowGrid(prev => !prev)}
        onAddTrack={handleAddTrack}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onFitToView={onFitToView}
        onUndo={onUndo || (() => {})}
        onRedo={onRedo || (() => {})}
      />

      {/* Context Menu */}
      {contextMenu && (
        <TimelineContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          clipId={contextMenu.clipId}
          isMuted={clips.find(c => c.id === contextMenu.clipId)?.muted || false}
          currentWaveform={clips.find(c => c.id === contextMenu.clipId)?.waveform || 'sine'}
          onAction={handleContextMenuAction}
          onClose={handleCloseContextMenu}
        />
      )}
    </div>
  );
});
