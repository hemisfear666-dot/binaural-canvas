import { useRef } from 'react';
import { Section } from '@/types/binaural';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { GripVertical, Volume2, VolumeX, Play, Square, Trash2, Edit3, ArrowRight, Star } from 'lucide-react';

interface SectionRowProps {
  section: Section;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  isEditing: boolean;
  isTesting: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onUpdate: (field: keyof Section, value: string | number | boolean | undefined) => void;
  onDelete: () => void;
  onTest: () => void;
  onStopTest: () => void;
  onToggleSelect: () => void;
  onEditClick: () => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onSaveAsPreset?: () => void;
}

export function SectionRow({
  section,
  index,
  isActive,
  isSelected,
  isEditing,
  isTesting,
  isDragging,
  isDragOver,
  onUpdate,
  onDelete,
  onTest,
  onStopTest,
  onToggleSelect,
  onEditClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onSaveAsPreset,
}: SectionRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  const baseClasses = `
    transition-all duration-200
    ${isEditing ? 'bg-primary/20 border-2 border-primary glow-blue ring-2 ring-primary/30' : ''}
    ${isSelected && !isEditing ? 'bg-accent/10 border border-accent/50 glow-red' : ''}
    ${isActive && !isSelected && !isEditing ? 'bg-primary/10 border border-primary glow-blue' : ''}
    ${!isActive && !isSelected && !isEditing ? 'bg-void-surface border border-transparent hover:border-border' : ''}
    ${isDragging ? 'opacity-40 border-dashed border-accent' : ''}
    ${isDragOver ? 'border-2 border-dashed border-accent scale-[1.01]' : ''}
    animate-slide-in
  `;

  const hasRampTargets = section.endCarrier !== undefined || section.endBeat !== undefined;
  const rampEnabled = section.rampEnabled ?? hasRampTargets;

  return (
    <>
      {/* Desktop Layout */}
      <div
        ref={rowRef}
        onDragOver={(e) => onDragOver(e, index)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, index)}
        className={`
          hidden md:block p-3 rounded-lg overflow-hidden ${baseClasses}
        `}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        {/* Main Row */}
        <div className="grid grid-cols-[24px_40px_minmax(0,2fr)_90px_90px_90px_100px_auto] gap-3 items-center">
          {/* Checkbox */}
          <div className="flex items-center justify-center">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              className="border-accent/50 data-[state=checked]:bg-accent data-[state=checked]:border-accent"
            />
          </div>

          {/* Drag Handle & Index */}
          <div
            className="flex items-center gap-1 cursor-grab"
            draggable
            onDragStart={(e) => {
              // Set section data for timeline drop
              e.dataTransfer.setData('application/section-id', section.id);
              e.dataTransfer.setData('application/section-json', JSON.stringify(section));
              onDragStart(e, index);
            }}
            onDragEnd={onDragEnd}
            title="Drag to reorder or drop on timeline"
            aria-label="Drag section to reorder or add to timeline"
          >
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
              className="h-8 w-[4.5rem] bg-void border-accent/50 text-center font-mono text-accent"
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
          <div className="flex items-center gap-1 shrink-0">
            {onSaveAsPreset && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onSaveAsPreset}
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-yellow-400 hover:bg-yellow-400/10"
                title="Save as preset"
              >
                <Star className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onEditClick}
              className={`h-7 w-7 shrink-0 ${isEditing ? 'text-primary bg-primary/20' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'}`}
              title="Edit with generator"
            >
              <Edit3 className="h-3 w-3" />
            </Button>
            {isTesting ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onStopTest}
                className="shrink-0 text-accent hover:text-accent hover:bg-accent/10 text-xs uppercase tracking-wider font-medium"
              >
                <Square className="h-3 w-3 mr-1" />
                Stop
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onTest}
                className="shrink-0 text-primary hover:text-primary-glow hover:bg-primary/10 text-xs uppercase tracking-wider font-medium"
              >
                <Play className="h-3 w-3 mr-1" />
                Test
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-accent hover:bg-accent/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Ramping Row */}
        <div className="mt-2 pt-2 border-t border-border/30">
          <div className="flex items-center gap-3 pl-16 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <ArrowRight className="h-3 w-3" />
              Ramp To
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const next = !rampEnabled;
                onUpdate('rampEnabled', next);
                if (next) {
                  if (section.endCarrier === undefined) onUpdate('endCarrier', section.carrier);
                  if (section.endBeat === undefined) onUpdate('endBeat', section.beat);
                }
              }}
              className={`h-6 px-2 text-[10px] uppercase tracking-wider font-medium ${
                rampEnabled ? 'text-primary bg-primary/10 hover:bg-primary/15' : 'text-muted-foreground hover:text-primary'
              }`}
              title={rampEnabled ? 'Disable ramp' : 'Enable ramp'}
            >
              {rampEnabled ? 'On' : 'Off'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onUpdate('rampEnabled', true);
                onUpdate('endCarrier', section.carrier);
                onUpdate('endBeat', section.beat);
              }}
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-accent"
              title="Reset ramp targets to current values"
            >
              Reset
            </Button>

            <div className={`flex items-center gap-3 ${!rampEnabled ? 'opacity-50' : ''}`}>
              {/* End Carrier */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Carrier:</span>
                <Input
                  type="number"
                  value={section.endCarrier ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdate('endCarrier', val === '' ? undefined : parseFloat(val) || section.carrier);
                  }}
                  min={20}
                  max={500}
                  placeholder={String(section.carrier)}
                  disabled={!rampEnabled}
                  className="h-7 w-[4.5rem] bg-void border-primary/30 text-center font-mono text-xs"
                />
                <span className="text-[10px] text-muted-foreground">Hz</span>
              </div>

              {/* End Beat */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Pulse:</span>
                <Input
                  type="number"
                  value={section.endBeat ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdate('endBeat', val === '' ? undefined : parseFloat(val) || section.beat);
                  }}
                  min={0.5}
                  max={100}
                  step={0.1}
                  placeholder={String(section.beat)}
                  disabled={!rampEnabled}
                  className="h-7 w-[4.5rem] bg-void border-accent/30 text-center font-mono text-xs text-accent"
                />
                <span className="text-[10px] text-muted-foreground">Hz</span>
              </div>
            </div>

            {hasRampTargets && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onUpdate('rampEnabled', false);
                  onUpdate('endCarrier', undefined);
                  onUpdate('endBeat', undefined);
                }}
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-accent"
                title="Clear ramp targets"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Layout - Card Style */}
      <div
        onDragOver={(e) => onDragOver(e, index)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, index)}
        className={`
          md:hidden p-3 rounded-lg ${baseClasses}
        `}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        {/* Top row: checkbox, drag handle, name, actions */}
        <div className="flex items-center gap-2 mb-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="border-accent/50 data-[state=checked]:bg-accent data-[state=checked]:border-accent shrink-0"
          />
          <div
            className="flex items-center gap-1 cursor-grab shrink-0"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/section-id', section.id);
              e.dataTransfer.setData('application/section-json', JSON.stringify(section));
              onDragStart(e, index);
            }}
            onDragEnd={onDragEnd}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-mono text-muted-foreground w-4">{index + 1}</span>
          </div>
          <Input
            value={section.name}
            onChange={(e) => onUpdate('name', e.target.value)}
            className="h-8 flex-1 bg-transparent border-0 border-b border-border/50 rounded-none focus:border-accent px-1 text-sm"
            placeholder="Section name"
          />
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onEditClick}
              className={`h-7 w-7 ${isEditing ? 'text-primary bg-primary/20' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'}`}
            >
              <Edit3 className="h-3 w-3" />
            </Button>
            {isTesting ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onStopTest}
                className="h-7 w-7 text-accent hover:text-accent hover:bg-accent/10"
              >
                <Square className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={onTest}
                className="h-7 w-7 text-primary hover:text-primary-glow hover:bg-primary/10"
              >
                <Play className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-7 w-7 text-muted-foreground hover:text-accent hover:bg-accent/10"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Parameters grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Base Carrier */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase text-primary font-medium w-14">Carrier</span>
            <Input
              type="number"
              value={section.carrier}
              onChange={(e) => onUpdate('carrier', parseFloat(e.target.value) || 100)}
              min={20}
              max={500}
              className="h-7 w-[4.5rem] bg-void border-primary/50 text-center font-mono text-xs"
            />
            <span className="text-[10px] text-muted-foreground">Hz</span>
          </div>

          {/* Base Pulse */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase text-accent font-medium w-14">Pulse</span>
            <Input
              type="number"
              value={section.beat}
              onChange={(e) => onUpdate('beat', parseFloat(e.target.value) || 1)}
              min={0.5}
              max={100}
              step={0.1}
              className="h-7 w-[4.5rem] bg-void border-accent/50 text-center font-mono text-xs text-accent"
            />
            <span className="text-[10px] text-muted-foreground">Hz</span>
          </div>

          {/* Ramp controls */}
          <div className="col-span-2 flex items-center justify-between gap-2 pt-1 border-t border-border/30">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <ArrowRight className="h-3 w-3" />
              Ramp To
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const next = !rampEnabled;
                  onUpdate('rampEnabled', next);
                  if (next) {
                    if (section.endCarrier === undefined) onUpdate('endCarrier', section.carrier);
                    if (section.endBeat === undefined) onUpdate('endBeat', section.beat);
                  }
                }}
                className={`h-6 px-2 text-[10px] uppercase tracking-wider font-medium ${
                  rampEnabled ? 'text-primary bg-primary/10' : 'text-muted-foreground'
                }`}
              >
                {rampEnabled ? 'On' : 'Off'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onUpdate('rampEnabled', true);
                  onUpdate('endCarrier', section.carrier);
                  onUpdate('endBeat', section.beat);
                }}
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-accent"
              >
                Reset
              </Button>
              {hasRampTargets && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onUpdate('rampEnabled', false);
                    onUpdate('endCarrier', undefined);
                    onUpdate('endBeat', undefined);
                  }}
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-accent"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* End Carrier */}
          <div className={`flex items-center gap-1 ${!rampEnabled ? 'opacity-50' : ''}`}>
            <span className="text-[10px] uppercase text-muted-foreground w-14">→ Carrier</span>
            <Input
              type="number"
              value={section.endCarrier ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                onUpdate('endCarrier', val === '' ? undefined : parseFloat(val) || section.carrier);
              }}
              min={20}
              max={500}
              placeholder={String(section.carrier)}
              disabled={!rampEnabled}
              className="h-7 w-[4.5rem] bg-void border-primary/30 text-center font-mono text-xs"
            />
            <span className="text-[10px] text-muted-foreground">Hz</span>
          </div>

          {/* End Pulse */}
          <div className={`flex items-center gap-1 ${!rampEnabled ? 'opacity-50' : ''}`}>
            <span className="text-[10px] uppercase text-muted-foreground w-14">→ Pulse</span>
            <Input
              type="number"
              value={section.endBeat ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                onUpdate('endBeat', val === '' ? undefined : parseFloat(val) || section.beat);
              }}
              min={0.5}
              max={100}
              step={0.1}
              placeholder={String(section.beat)}
              disabled={!rampEnabled}
              className="h-7 w-[4.5rem] bg-void border-accent/30 text-center font-mono text-xs text-accent"
            />
            <span className="text-[10px] text-muted-foreground">Hz</span>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase text-muted-foreground w-14">Duration</span>
            <Input
              type="number"
              value={section.duration}
              onChange={(e) => onUpdate('duration', parseFloat(e.target.value) || 0)}
              min={1}
              className="h-7 w-14 bg-void border-border text-center font-mono text-xs"
            />
            <span className="text-[10px] text-muted-foreground">sec</span>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onUpdate('muted', !section.muted)}
              className={`h-6 w-6 ${section.muted ? 'text-accent' : 'text-muted-foreground'}`}
            >
              {section.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
            </Button>
            <Slider
              value={[section.volume * 100]}
              onValueChange={([v]) => onUpdate('volume', v / 100)}
              max={100}
              step={1}
              disabled={section.muted}
              className={`flex-1 ${section.muted ? 'opacity-50' : ''}`}
            />
          </div>
        </div>
      </div>
    </>
  );
}
