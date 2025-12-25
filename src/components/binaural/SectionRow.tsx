import { useRef } from 'react';
import { Section } from '@/types/binaural';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { GripVertical, Volume2, VolumeX, Play, Trash2 } from 'lucide-react';

interface SectionRowProps {
  section: Section;
  index: number;
  isActive: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onUpdate: (field: keyof Section, value: string | number | boolean) => void;
  onDelete: () => void;
  onTest: () => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
}

export function SectionRow({
  section,
  index,
  isActive,
  isDragging,
  isDragOver,
  onUpdate,
  onDelete,
  onTest,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: SectionRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={rowRef}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={`
        grid grid-cols-[40px_2fr_1fr_1fr_1fr_120px_auto] gap-4 items-center
        p-3 rounded-lg transition-all duration-200 cursor-grab
        ${isActive ? 'bg-primary/10 border border-primary glow-blue' : 'bg-void-surface border border-transparent hover:border-border'}
        ${isDragging ? 'opacity-40 border-dashed border-primary' : ''}
        ${isDragOver ? 'border-2 border-dashed border-primary scale-[1.01]' : ''}
        animate-slide-in
      `}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Drag Handle & Index */}
      <div className="flex items-center gap-1">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        <span className="text-xs font-mono text-muted-foreground">{index + 1}</span>
      </div>

      {/* Name */}
      <Input
        value={section.name}
        onChange={(e) => onUpdate('name', e.target.value)}
        className="h-8 bg-transparent border-0 border-b border-border/50 rounded-none focus:border-primary px-0"
        placeholder="Section name"
      />

      {/* Duration (seconds) */}
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={section.duration}
          onChange={(e) => onUpdate('duration', parseFloat(e.target.value) || 0)}
          min={1}
          className="h-8 w-16 bg-void border-border text-center font-mono"
        />
        <span className="text-xs text-muted-foreground">sec</span>
      </div>

      {/* Carrier Frequency */}
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={section.carrier}
          onChange={(e) => onUpdate('carrier', parseFloat(e.target.value) || 100)}
          min={20}
          max={500}
          className="h-8 w-16 bg-void border-border text-center font-mono"
        />
        <span className="text-xs text-muted-foreground">Hz</span>
      </div>

      {/* Beat Frequency */}
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={section.beat}
          onChange={(e) => onUpdate('beat', parseFloat(e.target.value) || 1)}
          min={0.5}
          max={40}
          step={0.1}
          className="h-8 w-16 bg-void border-border text-center font-mono text-primary"
        />
        <span className="text-xs text-muted-foreground">Hz</span>
      </div>

      {/* Volume Slider */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onUpdate('muted', !section.muted)}
          className={`h-7 w-7 ${section.muted ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {section.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
        <Slider
          value={[section.volume * 100]}
          onValueChange={([v]) => onUpdate('volume', v / 100)}
          max={100}
          step={1}
          disabled={section.muted}
          className={`w-20 ${section.muted ? 'opacity-50' : ''}`}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onTest}
          className="text-primary hover:text-primary-glow hover:bg-primary/10 text-xs uppercase tracking-wider font-medium"
        >
          <Play className="h-3 w-3 mr-1" />
          Test
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-7 w-7 text-muted-foreground hover:text-accent hover:bg-accent/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
