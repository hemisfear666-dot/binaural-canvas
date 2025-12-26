import { useRef } from 'react';
import { Section } from '@/types/binaural';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { GripVertical, Volume2, VolumeX, Play, Trash2, Edit3 } from 'lucide-react';

interface SectionRowProps {
  section: Section;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  isEditing: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onUpdate: (field: keyof Section, value: string | number | boolean) => void;
  onDelete: () => void;
  onTest: () => void;
  onToggleSelect: () => void;
  onEditClick: () => void;
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
  isSelected,
  isEditing,
  isDragging,
  isDragOver,
  onUpdate,
  onDelete,
  onTest,
  onToggleSelect,
  onEditClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: SectionRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const handleDragStartInternal = (e: React.DragEvent) => {
    // Only allow drag from the grip handle
    if (dragHandleRef.current && !dragHandleRef.current.contains(e.target as Node)) {
      e.preventDefault();
      return;
    }
    onDragStart(e, index);
  };

  return (
    <div
      ref={rowRef}
      draggable
      onDragStart={handleDragStartInternal}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={`
        grid grid-cols-[24px_40px_2fr_90px_90px_90px_120px_auto] gap-4 items-center
        p-3 rounded-lg transition-all duration-200
        ${isEditing ? 'bg-primary/20 border-2 border-primary glow-blue ring-2 ring-primary/30' : ''}
        ${isSelected && !isEditing ? 'bg-accent/10 border border-accent/50 glow-red' : ''}
        ${isActive && !isSelected && !isEditing ? 'bg-primary/10 border border-primary glow-blue' : ''}
        ${!isActive && !isSelected && !isEditing ? 'bg-void-surface border border-transparent hover:border-border' : ''}
        ${isDragging ? 'opacity-40 border-dashed border-accent' : ''}
        ${isDragOver ? 'border-2 border-dashed border-accent scale-[1.01]' : ''}
        animate-slide-in
      `}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Checkbox */}
      <div className="flex items-center justify-center">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          className="border-accent/50 data-[state=checked]:bg-accent data-[state=checked]:border-accent"
        />
      </div>

      {/* Drag Handle & Index */}
      <div ref={dragHandleRef} className="flex items-center gap-1 cursor-grab">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-mono text-muted-foreground">{index + 1}</span>
      </div>

      {/* Name */}
      <Input
        value={section.name}
        onChange={(e) => onUpdate('name', e.target.value)}
        className="h-8 bg-transparent border-0 border-b border-border/50 rounded-none focus:border-accent px-0"
        placeholder="Section name"
      />

      {/* Carrier Frequency */}
      <div className="flex items-center justify-center gap-1">
        <Input
          type="number"
          value={section.carrier}
          onChange={(e) => onUpdate('carrier', parseFloat(e.target.value) || 100)}
          min={20}
          max={500}
          className="h-8 w-16 bg-void border-border text-center font-mono"
        />
        <span className="w-5 shrink-0 text-xs text-muted-foreground">Hz</span>
      </div>

      {/* Pulse (Beat) Frequency */}
      <div className="flex items-center justify-center gap-1">
        <Input
          type="number"
          value={section.beat}
          onChange={(e) => onUpdate('beat', parseFloat(e.target.value) || 1)}
          min={0.5}
          max={100}
          step={0.1}
          className="h-8 w-16 bg-void border-accent/50 text-center font-mono text-accent"
        />
        <span className="w-5 shrink-0 text-xs text-muted-foreground">Hz</span>
      </div>

      {/* Duration (seconds) */}
      <div className="flex items-center justify-center gap-1">
        <Input
          type="number"
          value={section.duration}
          onChange={(e) => onUpdate('duration', parseFloat(e.target.value) || 0)}
          min={1}
          className="h-8 w-16 bg-void border-border text-center font-mono"
        />
        <span className="w-5 shrink-0 text-xs text-muted-foreground">sec</span>
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
          size="icon"
          onClick={onEditClick}
          className={`h-7 w-7 ${isEditing ? 'text-primary bg-primary/20' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'}`}
          title="Edit with generator"
        >
          <Edit3 className="h-3 w-3" />
        </Button>
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
