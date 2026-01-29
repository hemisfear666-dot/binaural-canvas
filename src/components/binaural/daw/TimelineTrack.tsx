import { memo, useCallback, useState, useRef } from 'react';
import { TimelineTrack as TimelineTrackType, TimelineClip, TRACK_COLORS } from '@/types/daw';
import { Section } from '@/types/binaural';
import { TimelineClipComponent } from './TimelineClip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Volume2, VolumeX, Headphones, MoreVertical, Palette } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';

interface TimelineTrackProps {
  track: TimelineTrackType;
  clips: TimelineClip[];
  sections: Section[];
  pixelsPerSecond: number;
  totalWidth: number;
  selectedClipIds: Set<string>;
  playingClipId: string | null;
  gridLines: number[];
  onTrackUpdate: (trackId: string, updates: Partial<TimelineTrackType>) => void;
  onTrackDelete: (trackId: string) => void;
  onClipSelect: (clipId: string, additive: boolean) => void;
  onClipMove: (clipId: string, newStartTime: number, newTrackId?: string) => void;
  onClipResize: (clipId: string, newDuration: number, edge: 'start' | 'end') => void;
  onClipContextMenu: (e: React.MouseEvent, clipId: string) => void;
  onClipDoubleClick: (clipId: string) => void;
  onTrackClick: (trackId: string, time: number) => void;
  snapToGrid: (time: number) => number;
  // Drag-drop props
  isDragOver?: boolean;
  dropTime?: number;
  onDragOver?: (e: React.DragEvent, trackId: string, trackElement: HTMLElement) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent, trackId: string, trackElement: HTMLElement) => void;
}

export const TimelineTrackRow = memo(function TimelineTrackRow({
  track,
  clips,
  sections,
  pixelsPerSecond,
  totalWidth,
  selectedClipIds,
  playingClipId,
  gridLines,
  onTrackUpdate,
  onTrackDelete,
  onClipSelect,
  onClipMove,
  onClipResize,
  onClipContextMenu,
  onClipDoubleClick,
  onTrackClick,
  snapToGrid,
  isDragOver,
  dropTime,
  onDragOver,
  onDragLeave,
  onDrop,
}: TimelineTrackProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(track.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const trackContentRef = useRef<HTMLDivElement>(null);

  const handleNameSubmit = useCallback(() => {
    if (editName.trim()) {
      onTrackUpdate(track.id, { name: editName.trim() });
    } else {
      setEditName(track.name);
    }
    setIsEditing(false);
  }, [editName, track.id, track.name, onTrackUpdate]);

  const handleNameDoubleClick = useCallback(() => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, []);

  const handleTrackAreaClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = x / pixelsPerSecond;
    onTrackClick(track.id, time);
  }, [track.id, pixelsPerSecond, onTrackClick]);

  const toggleMute = useCallback(() => {
    onTrackUpdate(track.id, { muted: !track.muted });
  }, [track.id, track.muted, onTrackUpdate]);

  const toggleSolo = useCallback(() => {
    onTrackUpdate(track.id, { solo: !track.solo });
  }, [track.id, track.solo, onTrackUpdate]);

  const handleColorChange = useCallback((color: string) => {
    onTrackUpdate(track.id, { color });
  }, [track.id, onTrackUpdate]);

  return (
    <div className="flex border-b border-border/50 group">
      {/* Track header */}
      <div 
        className="w-40 shrink-0 p-2 flex flex-col gap-1 border-r border-border/50"
        style={{ 
          background: `linear-gradient(90deg, hsl(${track.color} / 0.15) 0%, transparent 100%)`,
          borderLeft: `3px solid hsl(${track.color})`,
        }}
      >
        {/* Track name */}
        <div className="flex items-center gap-1">
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
                if (e.key === 'Escape') {
                  setEditName(track.name);
                  setIsEditing(false);
                }
              }}
              className="h-5 text-xs px-1 bg-void border-border"
              autoFocus
            />
          ) : (
            <span 
              className="text-xs font-medium text-foreground truncate cursor-text flex-1"
              onDoubleClick={handleNameDoubleClick}
            >
              {track.name}
            </span>
          )}
          
          {/* Track menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Palette className="h-3.5 w-3.5 mr-2" />
                  Change Color
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <div className="grid grid-cols-4 gap-1 p-2">
                    {TRACK_COLORS.map((color) => (
                      <button
                        key={color}
                        className="w-6 h-6 rounded-md hover:scale-110 transition-transform ring-2 ring-transparent hover:ring-white/50"
                        style={{ background: `hsl(${color})` }}
                        onClick={() => handleColorChange(color)}
                      />
                    ))}
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive"
                onClick={() => onTrackDelete(track.id)}
              >
                Delete Track
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Track controls */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={`h-5 w-5 ${track.muted ? 'bg-accent/20 text-accent' : 'text-muted-foreground'}`}
            onClick={toggleMute}
            title="Mute"
          >
            {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-5 w-5 ${track.solo ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
            onClick={toggleSolo}
            title="Solo"
          >
            <Headphones className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Track content area - clips go here */}
      <div 
        ref={trackContentRef}
        className={`flex-1 h-14 relative overflow-hidden cursor-crosshair transition-colors ${
          isDragOver ? 'bg-primary/10 ring-2 ring-primary ring-inset' : ''
        }`}
        style={{ minWidth: totalWidth }}
        onClick={handleTrackAreaClick}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onDragOver && trackContentRef.current) {
            onDragOver(e, track.id, trackContentRef.current);
          }
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (onDragLeave) onDragLeave();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onDrop && trackContentRef.current) {
            onDrop(e, track.id, trackContentRef.current);
          }
        }}
      >
        {/* Grid lines */}
        {gridLines.map((time, idx) => (
          <div
            key={time}
            className={`absolute top-0 bottom-0 ${
              idx % 4 === 0 
                ? 'w-px bg-muted-foreground/40' 
                : 'w-px bg-muted-foreground/20'
            }`}
            style={{ left: time * pixelsPerSecond }}
          />
        ))}

        {/* Drop indicator */}
        {isDragOver && dropTime !== undefined && (
          <div
            className="absolute top-1 bottom-1 w-1 bg-primary rounded-full z-20 pointer-events-none"
            style={{ left: dropTime * pixelsPerSecond }}
          />
        )}

        {/* Track muted overlay */}
        {track.muted && (
          <div className="absolute inset-0 bg-void/50 pointer-events-none z-5" />
        )}

        {/* Clips */}
        {clips.map((clip) => (
          <TimelineClipComponent
            key={clip.id}
            clip={clip}
            section={sections.find(s => s.id === clip.sectionId)}
            pixelsPerSecond={pixelsPerSecond}
            isSelected={selectedClipIds.has(clip.id)}
            isPlaying={playingClipId === clip.id}
            trackColor={track.color}
            onSelect={onClipSelect}
            onMove={onClipMove}
            onResize={onClipResize}
            onContextMenu={onClipContextMenu}
            onDoubleClick={onClipDoubleClick}
            snapToGrid={snapToGrid}
          />
        ))}
      </div>
    </div>
  );
});
