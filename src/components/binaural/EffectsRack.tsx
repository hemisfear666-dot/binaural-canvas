import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Waves, Filter, Move, Music, TreeDeciduous, AudioWaveform, Sparkles, Box, Clock } from 'lucide-react';
import { EffectsSettings, EffectsTarget, SingleEffectSettings } from '@/types/binaural';

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

export function EffectsRack({ effects, onEffectsChange }: EffectsRackProps) {
  const [activeTarget, setActiveTarget] = useState<EffectsTarget>('song');

  const currentEffects: SingleEffectSettings = effects[activeTarget];

  const handleEffectChange = (newSettings: SingleEffectSettings) => {
    onEffectsChange({
      ...effects,
      [activeTarget]: newSettings,
    });
  };

  return (
    <div className="panel rounded-lg p-3 sm:p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest text-primary font-medium">
          Effects Rack
        </h3>
      </div>

      {/* Target Selector */}
      <div className="flex gap-1 p-1 bg-void rounded-lg">
        {(Object.keys(targetLabels) as EffectsTarget[]).map((target) => (
          <button
            key={target}
            onClick={() => setActiveTarget(target)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
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

      {/* Reverb */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-primary" />
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Reverb
            </Label>
          </div>
          <Switch
            checked={currentEffects.reverb.enabled}
            onCheckedChange={(enabled) =>
              handleEffectChange({ ...currentEffects, reverb: { ...currentEffects.reverb, enabled } })
            }
            className="data-[state=checked]:bg-primary"
          />
        </div>
        <div className={`flex items-center gap-2 ${!currentEffects.reverb.enabled ? 'opacity-50' : ''}`}>
          <span className="text-[10px] text-muted-foreground w-12">Amount</span>
          <Slider
            value={[currentEffects.reverb.amount * 100]}
            onValueChange={([v]) =>
              handleEffectChange({ ...currentEffects, reverb: { ...currentEffects.reverb, amount: v / 100 } })
            }
            max={100}
            step={1}
            disabled={!currentEffects.reverb.enabled}
            className="flex-1"
          />
          <span className="font-mono text-xs text-muted-foreground w-8">
            {Math.round(currentEffects.reverb.amount * 100)}%
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Low-pass Filter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-accent" />
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Low-Pass Filter
            </Label>
          </div>
          <Switch
            checked={currentEffects.lowpass.enabled}
            onCheckedChange={(enabled) =>
              handleEffectChange({ ...currentEffects, lowpass: { ...currentEffects.lowpass, enabled } })
            }
            className="data-[state=checked]:bg-accent"
          />
        </div>
        <div className={`flex items-center gap-2 ${!currentEffects.lowpass.enabled ? 'opacity-50' : ''}`}>
          <span className="text-[10px] text-muted-foreground w-12">Cutoff</span>
          <Slider
            value={[currentEffects.lowpass.frequency]}
            onValueChange={([v]) =>
              handleEffectChange({ ...currentEffects, lowpass: { ...currentEffects.lowpass, frequency: v } })
            }
            min={100}
            max={8000}
            step={50}
            disabled={!currentEffects.lowpass.enabled}
            className="flex-1"
          />
          <span className="font-mono text-xs text-muted-foreground w-14">
            {currentEffects.lowpass.frequency}Hz
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Auto-Pan (Spatial) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Move className="h-4 w-4 text-primary" />
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Spatial Pan
            </Label>
          </div>
          <Switch
            checked={currentEffects.autoPan.enabled}
            onCheckedChange={(enabled) =>
              handleEffectChange({ ...currentEffects, autoPan: { ...currentEffects.autoPan, enabled } })
            }
            className="data-[state=checked]:bg-primary"
          />
        </div>
        <div className={`space-y-2 ${!currentEffects.autoPan.enabled ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-12">Rate</span>
            <Slider
              value={[currentEffects.autoPan.rate * 100]}
              onValueChange={([v]) =>
                handleEffectChange({ ...currentEffects, autoPan: { ...currentEffects.autoPan, rate: v / 100 } })
              }
              min={1}
              max={50}
              step={1}
              disabled={!currentEffects.autoPan.enabled}
              className="flex-1"
            />
            <span className="font-mono text-xs text-muted-foreground w-12">
              {currentEffects.autoPan.rate.toFixed(2)}Hz
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-12">Depth</span>
            <Slider
              value={[currentEffects.autoPan.depth * 100]}
              onValueChange={([v]) =>
                handleEffectChange({ ...currentEffects, autoPan: { ...currentEffects.autoPan, depth: v / 100 } })
              }
              max={100}
              step={1}
              disabled={!currentEffects.autoPan.enabled}
              className="flex-1"
            />
            <span className="font-mono text-xs text-muted-foreground w-8">
              {Math.round(currentEffects.autoPan.depth * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* 3D Audio */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box className="h-4 w-4 text-accent" />
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              3D Audio
            </Label>
          </div>
          <Switch
            checked={currentEffects.audio3d.enabled}
            onCheckedChange={(enabled) =>
              handleEffectChange({ ...currentEffects, audio3d: { ...currentEffects.audio3d, enabled } })
            }
            className="data-[state=checked]:bg-accent"
          />
        </div>
        <div className={`flex items-center gap-2 ${!currentEffects.audio3d.enabled ? 'opacity-50' : ''}`}>
          <span className="text-[10px] text-muted-foreground w-12">Intensity</span>
          <Slider
            value={[currentEffects.audio3d.intensity * 100]}
            onValueChange={([v]) =>
              handleEffectChange({ ...currentEffects, audio3d: { ...currentEffects.audio3d, intensity: v / 100 } })
            }
            max={100}
            step={1}
            disabled={!currentEffects.audio3d.enabled}
            className="flex-1"
          />
          <span className="font-mono text-xs text-muted-foreground w-8">
            {Math.round(currentEffects.audio3d.intensity * 100)}%
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Timeshift */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Timeshift
            </Label>
          </div>
          <Switch
            checked={currentEffects.timeshift.enabled}
            onCheckedChange={(enabled) =>
              handleEffectChange({ ...currentEffects, timeshift: { ...currentEffects.timeshift, enabled } })
            }
            className="data-[state=checked]:bg-primary"
          />
        </div>
        <div className={`flex items-center gap-2 ${!currentEffects.timeshift.enabled ? 'opacity-50' : ''}`}>
          <span className="text-[10px] text-muted-foreground w-12">Speed</span>
          <Slider
            value={[currentEffects.timeshift.rate * 100]}
            onValueChange={([v]) =>
              handleEffectChange({ ...currentEffects, timeshift: { ...currentEffects.timeshift, rate: v / 100 } })
            }
            min={50}
            max={200}
            step={5}
            disabled={!currentEffects.timeshift.enabled}
            className="flex-1"
          />
          <span className="font-mono text-xs text-muted-foreground w-10">
            {currentEffects.timeshift.rate.toFixed(2)}x
          </span>
        </div>
      </div>
    </div>
  );
}
