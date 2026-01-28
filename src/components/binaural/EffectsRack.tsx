import { useState, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Waves, Filter, Move, Music, TreeDeciduous, AudioWaveform, Sparkles, Box, Clock } from 'lucide-react';
import { EffectsSettings, EffectsTarget, SingleEffectSettings } from '@/types/binaural';
import { toast } from 'sonner';

interface EffectsRackProps {
  effects: EffectsSettings;
  onEffectsChange: (effects: EffectsSettings) => void;
}

const targetLabels: Record<EffectsTarget, { label: string; icon: React.ReactNode }> = {
  song: { label: 'Song', icon: <Music className="h-3 w-3" /> },
  soundscape: { label: 'Soundscape', icon: <TreeDeciduous className="h-3 w-3" /> },
  noise: { label: 'Noise', icon: <AudioWaveform className="h-3 w-3" /> },
  ambientMusic: { label: 'Ambience', icon: <Sparkles className="h-3 w-3" /> },
};

// Vertical slider component
function VerticalSlider({ 
  value, 
  onChange, 
  min = 0, 
  max = 100, 
  step = 1,
  disabled = false,
  label,
  unit = '%',
  formatValue = (v: number) => Math.round(v).toString()
}: { 
  value: number; 
  onChange: (v: number) => void; 
  min?: number; 
  max?: number; 
  step?: number;
  disabled?: boolean;
  label: string;
  unit?: string;
  formatValue?: (v: number) => string;
}) {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <div className={`flex flex-col items-center gap-1 ${disabled ? 'opacity-40' : ''}`}>
      <span className="text-[9px] text-muted-foreground font-mono">
        {formatValue(value)}{unit}
      </span>
      <div className="relative h-16 w-2 bg-secondary rounded-full overflow-hidden">
        <div 
          className="absolute bottom-0 left-0 right-0 bg-primary rounded-full transition-all"
          style={{ height: `${percentage}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
        />
      </div>
      <span className="text-[8px] uppercase tracking-wider text-muted-foreground text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

// Effect module component
function EffectModule({
  icon,
  name,
  enabled,
  onToggle,
  children,
  color = 'primary'
}: {
  icon: React.ReactNode;
  name: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
  color?: 'primary' | 'accent';
}) {
  return (
    <div className={`flex flex-col items-center p-2 rounded-lg bg-void/50 border border-border/30 transition-all ${enabled ? 'border-' + color + '/50' : ''}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`${enabled ? (color === 'primary' ? 'text-primary' : 'text-accent') : 'text-muted-foreground'}`}>
          {icon}
        </span>
        <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">
          {name}
        </Label>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        className={`mb-2 scale-75 ${color === 'primary' ? 'data-[state=checked]:bg-primary' : 'data-[state=checked]:bg-accent'}`}
      />
      <div className={`flex gap-3 ${!enabled ? 'opacity-40 pointer-events-none' : ''}`}>
        {children}
      </div>
    </div>
  );
}

export function EffectsRack({ effects, onEffectsChange }: EffectsRackProps) {
  const [activeTarget, setActiveTarget] = useState<EffectsTarget>('song');

  const currentEffects: SingleEffectSettings = effects[activeTarget];

  const handleEffectChange = useCallback((newSettings: SingleEffectSettings) => {
    onEffectsChange({
      ...effects,
      [activeTarget]: newSettings,
    });
  }, [effects, activeTarget, onEffectsChange]);

  const handleToggleWithToast = useCallback((
    effectName: string, 
    enabled: boolean, 
    updateFn: () => SingleEffectSettings
  ) => {
    handleEffectChange(updateFn());
    toast(enabled ? `${effectName} enabled` : `${effectName} disabled`, {
      duration: 1500,
      className: 'text-xs',
    });
  }, [handleEffectChange]);

  return (
    <div className="panel rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest text-primary font-medium">
          Effects Rack
        </h3>
      </div>

      {/* Target Selector */}
      <div className="flex gap-0.5 p-0.5 bg-void rounded-lg">
        {(Object.keys(targetLabels) as EffectsTarget[]).map((target) => (
          <button
            key={target}
            onClick={() => setActiveTarget(target)}
            className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium transition-all ${
              activeTarget === target
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {targetLabels[target].icon}
            <span className="hidden sm:inline">{targetLabels[target].label}</span>
          </button>
        ))}
      </div>

      {/* Effects Grid - horizontal layout with vertical sliders */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {/* Reverb */}
        <EffectModule
          icon={<Waves className="h-3.5 w-3.5" />}
          name="Reverb"
          enabled={currentEffects.reverb.enabled}
          onToggle={(enabled) => handleToggleWithToast('Reverb', enabled, () => ({
            ...currentEffects,
            reverb: { ...currentEffects.reverb, enabled }
          }))}
        >
          <VerticalSlider
            value={currentEffects.reverb.amount * 100}
            onChange={(v) => handleEffectChange({ 
              ...currentEffects, 
              reverb: { ...currentEffects.reverb, amount: v / 100 } 
            })}
            disabled={!currentEffects.reverb.enabled}
            label="Amt"
          />
        </EffectModule>

        {/* Low-pass Filter */}
        <EffectModule
          icon={<Filter className="h-3.5 w-3.5" />}
          name="LPF"
          enabled={currentEffects.lowpass.enabled}
          onToggle={(enabled) => handleToggleWithToast('Low-pass Filter', enabled, () => ({
            ...currentEffects,
            lowpass: { ...currentEffects.lowpass, enabled }
          }))}
          color="accent"
        >
          <VerticalSlider
            value={currentEffects.lowpass.frequency}
            onChange={(v) => handleEffectChange({ 
              ...currentEffects, 
              lowpass: { ...currentEffects.lowpass, frequency: v } 
            })}
            min={100}
            max={8000}
            step={50}
            disabled={!currentEffects.lowpass.enabled}
            label="Freq"
            unit="Hz"
            formatValue={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toString()}
          />
        </EffectModule>

        {/* Spatial Pan */}
        <EffectModule
          icon={<Move className="h-3.5 w-3.5" />}
          name="Pan"
          enabled={currentEffects.autoPan.enabled}
          onToggle={(enabled) => handleToggleWithToast('Spatial Pan', enabled, () => ({
            ...currentEffects,
            autoPan: { ...currentEffects.autoPan, enabled }
          }))}
        >
          <VerticalSlider
            value={currentEffects.autoPan.rate * 100}
            onChange={(v) => handleEffectChange({ 
              ...currentEffects, 
              autoPan: { ...currentEffects.autoPan, rate: v / 100 } 
            })}
            min={1}
            max={50}
            disabled={!currentEffects.autoPan.enabled}
            label="Rate"
            unit="Hz"
            formatValue={(v) => (v / 100).toFixed(1)}
          />
          <VerticalSlider
            value={currentEffects.autoPan.depth * 100}
            onChange={(v) => handleEffectChange({ 
              ...currentEffects, 
              autoPan: { ...currentEffects.autoPan, depth: v / 100 } 
            })}
            disabled={!currentEffects.autoPan.enabled}
            label="Dpth"
          />
        </EffectModule>

        {/* 3D Audio */}
        <EffectModule
          icon={<Box className="h-3.5 w-3.5" />}
          name="3D"
          enabled={currentEffects.audio3d.enabled}
          onToggle={(enabled) => handleToggleWithToast('3D Audio', enabled, () => ({
            ...currentEffects,
            audio3d: { ...currentEffects.audio3d, enabled }
          }))}
          color="accent"
        >
          <VerticalSlider
            value={currentEffects.audio3d.intensity * 100}
            onChange={(v) => handleEffectChange({ 
              ...currentEffects, 
              audio3d: { ...currentEffects.audio3d, intensity: v / 100 } 
            })}
            disabled={!currentEffects.audio3d.enabled}
            label="Int"
          />
        </EffectModule>

        {/* Timeshift */}
        <EffectModule
          icon={<Clock className="h-3.5 w-3.5" />}
          name="Time"
          enabled={currentEffects.timeshift.enabled}
          onToggle={(enabled) => handleToggleWithToast('Timeshift', enabled, () => ({
            ...currentEffects,
            timeshift: { ...currentEffects.timeshift, enabled }
          }))}
        >
          <VerticalSlider
            value={currentEffects.timeshift.rate * 100}
            onChange={(v) => handleEffectChange({ 
              ...currentEffects, 
              timeshift: { ...currentEffects.timeshift, rate: v / 100 } 
            })}
            min={50}
            max={200}
            disabled={!currentEffects.timeshift.enabled}
            label="Spd"
            unit="x"
            formatValue={(v) => (v / 100).toFixed(2)}
          />
        </EffectModule>
      </div>
    </div>
  );
}
