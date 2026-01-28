import { Button } from '@/components/ui/button';
import { 
  Grid3X3, 
  Magnet, 
  Plus, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Undo2,
  Redo2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DEFAULT_GRID_SIZES } from '@/types/daw';

interface TimelineFooterProps {
  snapEnabled: boolean;
  gridSize: number;
  showGrid: boolean;
  bpm: number;
  pixelsPerSecond: number;
  canUndo: boolean;
  canRedo: boolean;
  onSnapToggle: () => void;
  onGridSizeChange: (size: number) => void;
  onGridVisibilityToggle: () => void;
  onAddTrack: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function TimelineFooter({
  snapEnabled,
  gridSize,
  showGrid,
  bpm,
  pixelsPerSecond,
  canUndo,
  canRedo,
  onSnapToggle,
  onGridSizeChange,
  onGridVisibilityToggle,
  onAddTrack,
  onZoomIn,
  onZoomOut,
  onFitToView,
  onUndo,
  onRedo,
}: TimelineFooterProps) {
  // Calculate bar duration from BPM (4 beats per bar)
  const barDuration = (60 / bpm) * 4;

  // Get current grid size label
  const getGridSizeLabel = () => {
    const preset = DEFAULT_GRID_SIZES.find(g => g.value === gridSize);
    if (preset) return preset.label;
    if (Math.abs(gridSize - barDuration) < 0.01) return 'Bar';
    return `${gridSize}s`;
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-void-surface gap-2">
      {/* Left side - Track controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddTrack}
          className="h-7 gap-1 text-muted-foreground hover:text-primary hover:bg-primary/10"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="text-xs">Add Track</span>
        </Button>
      </div>

      {/* Center - Grid controls */}
      <div className="flex items-center gap-2">
        {/* Grid visibility */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onGridVisibilityToggle}
          className={`h-7 w-7 ${showGrid ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
          title="Show grid"
        >
          <Grid3X3 className="h-4 w-4" />
        </Button>

        {/* Snap to grid */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSnapToggle}
          className={`h-7 w-7 ${snapEnabled ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
          title="Snap to grid"
        >
          <Magnet className="h-4 w-4" />
        </Button>

        {/* Grid size selector */}
        <Select
          value={String(gridSize)}
          onValueChange={(value) => {
            if (value === 'bar') {
              onGridSizeChange(barDuration);
            } else {
              onGridSizeChange(Number(value));
            }
          }}
        >
          <SelectTrigger className="h-7 w-20 text-xs bg-void border-border">
            <SelectValue>{getGridSizeLabel()}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {DEFAULT_GRID_SIZES.map((size) => (
              <SelectItem 
                key={size.label} 
                value={size.value === 'bar' ? 'bar' : String(size.value)}
              >
                {size.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Right side - Zoom & History */}
      <div className="flex items-center gap-1">
        {/* Undo/Redo */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onUndo}
          disabled={!canUndo}
          className="h-7 w-7 text-muted-foreground hover:text-accent hover:bg-accent/10 disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRedo}
          disabled={!canRedo}
          className="h-7 w-7 text-muted-foreground hover:text-accent hover:bg-accent/10 disabled:opacity-30"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Zoom controls */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomOut}
          className="h-7 w-7 text-muted-foreground hover:text-accent hover:bg-accent/10"
          title="Zoom out (-)"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs font-mono text-accent min-w-[3rem] text-center">
          {pixelsPerSecond.toFixed(1)}x
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomIn}
          className="h-7 w-7 text-muted-foreground hover:text-accent hover:bg-accent/10"
          title="Zoom in (+)"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onFitToView}
          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
          title="Fit to view"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
