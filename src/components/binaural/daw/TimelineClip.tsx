import { useRef, useState, useCallback, useEffect, memo } from 'react';
import { TimelineClip as TimelineClipType } from '@/types/daw';
import { Section } from '@/types/binaural';
import { VolumeX } from 'lucide-react';

interface TimelineClipProps {
  clip: TimelineClipType;
  section: Section | undefined;
  pixelsPerSecond: number;
  isSelected: boolean;
  isPlaying: boolean;
  trackColor: string;
  onSelect: (clipId: string, additive: boolean) => void;
  onMove: (clipId: string, newStartTime: number, newTrackId?: string) => void;
  onResize: (clipId: string, newDuration: number, edge: 'start' | 'end') => void;
  onContextMenu: (e: React.MouseEvent, clipId: string) => void;
  onDoubleClick: (clipId: string) => void;
  snapToGrid: (time: number) => number;
}

export const TimelineClipComponent = memo(function TimelineClipComponent({
  clip,
  section,
  pixelsPerSecond,
  isSelected,
  isPlaying,
  trackColor,
  onSelect,
  onMove,
  onResize,
  onContextMenu,
  onDoubleClick,
  snapToGrid,
}: TimelineClipProps) {
  const clipRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<'start' | 'end' | null>(null);
  const dragStartRef = useRef({ x: 0, startTime: 0, duration: 0 });

  const width = clip.duration * pixelsPerSecond;
  const left = clip.startTime * pixelsPerSecond;
  const minWidth = 20; // Minimum clip width in pixels

  // Handle mouse down for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.stopPropagation();
    
    onSelect(clip.id, e.shiftKey || e.ctrlKey || e.metaKey);
    
    dragStartRef.current = {
      x: e.clientX,
      startTime: clip.startTime,
      duration: clip.duration,
    };
    setIsDragging(true);
  }, [clip.id, clip.startTime, clip.duration, onSelect]);

  // Handle resize handles
  const handleResizeStart = useCallback((e: React.MouseEvent, edge: 'start' | 'end') => {
    e.stopPropagation();
    e.preventDefault();
    
    dragStartRef.current = {
      x: e.clientX,
      startTime: clip.startTime,
      duration: clip.duration,
    };
    setIsResizing(edge);
  }, [clip.startTime, clip.duration]);

  // Global mouse move/up handlers
  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaTime = deltaX / pixelsPerSecond;

      if (isDragging) {
        const newStartTime = snapToGrid(Math.max(0, dragStartRef.current.startTime + deltaTime));
        onMove(clip.id, newStartTime);
      } else if (isResizing === 'end') {
        const newDuration = Math.max(
          minWidth / pixelsPerSecond,
          dragStartRef.current.duration + deltaTime
        );
        onResize(clip.id, snapToGrid(newDuration), 'end');
      } else if (isResizing === 'start') {
        // Resize from start: adjust both start time and duration
        const maxDelta = dragStartRef.current.duration - (minWidth / pixelsPerSecond);
        const clampedDelta = Math.min(maxDelta, Math.max(-dragStartRef.current.startTime, deltaTime));
        const newStartTime = snapToGrid(dragStartRef.current.startTime + clampedDelta);
        const newDuration = dragStartRef.current.duration - clampedDelta;
        if (newDuration > minWidth / pixelsPerSecond) {
          onMove(clip.id, newStartTime);
          onResize(clip.id, newDuration, 'start');
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, clip.id, pixelsPerSecond, snapToGrid, onMove, onResize]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(e, clip.id);
  }, [clip.id, onContextMenu]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick(clip.id);
  }, [clip.id, onDoubleClick]);

  // Use custom clip color or track color
  const clipColor = clip.color || trackColor;
  const displayName = section?.name || 'Unknown';
  const beatHz = section?.beat?.toFixed(1) || '0';

  return (
    <div
      ref={clipRef}
      className={`
        absolute top-1 bottom-1 rounded-md cursor-grab transition-shadow
        ${isSelected ? 'ring-2 ring-white/50 z-10' : ''}
        ${isDragging ? 'cursor-grabbing opacity-80 z-20' : ''}
        ${clip.muted ? 'opacity-40' : ''}
        ${isPlaying && !clip.muted ? 'ring-2 ring-accent shadow-lg shadow-accent/30' : ''}
      `}
      style={{
        left,
        width: Math.max(minWidth, width),
        background: `linear-gradient(135deg, hsl(${clipColor} / 0.6) 0%, hsl(${clipColor} / 0.3) 100%)`,
        borderLeft: `3px solid hsl(${clipColor})`,
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
    >
      {/* Resize handle - left */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 z-10"
        onMouseDown={(e) => handleResizeStart(e, 'start')}
      />

      {/* Clip content */}
      <div className="absolute inset-0 px-2 py-1 overflow-hidden pointer-events-none">
        {/* Waveform visualization */}
        <div className="absolute inset-0 flex items-center justify-center gap-0.5 px-3 opacity-40">
          {Array.from({ length: Math.max(1, Math.floor(width / 6)) }).map((_, i) => (
            <div
              key={i}
              className={`w-0.5 bg-white rounded-full ${isPlaying && !clip.muted ? 'animate-waveform' : ''}`}
              style={{
                height: `${20 + Math.sin(i * 0.5) * 30 + Math.random() * 20}%`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>

        {/* Clip info */}
        <div className="relative z-10 h-full flex flex-col justify-between">
          <div className="flex items-center gap-1">
            {clip.muted && <VolumeX className="h-3 w-3 text-white/70" />}
            <span className="text-[10px] font-medium text-white truncate">
              {displayName}
            </span>
          </div>
          {width > 60 && (
            <span className="text-[9px] font-mono text-white/70 px-1 py-0.5 rounded bg-black/20 w-fit">
              {beatHz}Hz
            </span>
          )}
        </div>
      </div>

      {/* Resize handle - right */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 z-10"
        onMouseDown={(e) => handleResizeStart(e, 'end')}
      />
    </div>
  );
});
