import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Waves, Filter, Move } from 'lucide-react';

export interface EffectsSettings {
  reverb: {
    enabled: boolean;
    amount: number; // 0-1
  };
  lowpass: {
    enabled: boolean;
    frequency: number; // Hz
  };
  autoPan: {
    enabled: boolean;
    rate: number; // Hz
    depth: number; // 0-1
  };
}

interface EffectsRackProps {
  effects: EffectsSettings;
  onEffectsChange: (effects: EffectsSettings) => void;
}

export function EffectsRack({ effects, onEffectsChange }: EffectsRackProps) {
  return (
    <div className="panel rounded-lg p-3 sm:p-4 space-y-4">
      <h3 className="text-xs uppercase tracking-widest text-primary font-medium">
        Effects Rack
      </h3>

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
            checked={effects.reverb.enabled}
            onCheckedChange={(enabled) =>
              onEffectsChange({ ...effects, reverb: { ...effects.reverb, enabled } })
            }
            className="data-[state=checked]:bg-primary"
          />
        </div>
        <div className={`flex items-center gap-2 ${!effects.reverb.enabled ? 'opacity-50' : ''}`}>
          <span className="text-[10px] text-muted-foreground w-12">Amount</span>
          <Slider
            value={[effects.reverb.amount * 100]}
            onValueChange={([v]) =>
              onEffectsChange({ ...effects, reverb: { ...effects.reverb, amount: v / 100 } })
            }
            max={100}
            step={1}
            disabled={!effects.reverb.enabled}
            className="flex-1"
          />
          <span className="font-mono text-xs text-muted-foreground w-8">
            {Math.round(effects.reverb.amount * 100)}%
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
            checked={effects.lowpass.enabled}
            onCheckedChange={(enabled) =>
              onEffectsChange({ ...effects, lowpass: { ...effects.lowpass, enabled } })
            }
            className="data-[state=checked]:bg-accent"
          />
        </div>
        <div className={`flex items-center gap-2 ${!effects.lowpass.enabled ? 'opacity-50' : ''}`}>
          <span className="text-[10px] text-muted-foreground w-12">Cutoff</span>
          <Slider
            value={[effects.lowpass.frequency]}
            onValueChange={([v]) =>
              onEffectsChange({ ...effects, lowpass: { ...effects.lowpass, frequency: v } })
            }
            min={100}
            max={8000}
            step={50}
            disabled={!effects.lowpass.enabled}
            className="flex-1"
          />
          <span className="font-mono text-xs text-muted-foreground w-14">
            {effects.lowpass.frequency}Hz
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
            checked={effects.autoPan.enabled}
            onCheckedChange={(enabled) =>
              onEffectsChange({ ...effects, autoPan: { ...effects.autoPan, enabled } })
            }
            className="data-[state=checked]:bg-primary"
          />
        </div>
        <div className={`space-y-2 ${!effects.autoPan.enabled ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-12">Rate</span>
            <Slider
              value={[effects.autoPan.rate * 100]}
              onValueChange={([v]) =>
                onEffectsChange({ ...effects, autoPan: { ...effects.autoPan, rate: v / 100 } })
              }
              min={1}
              max={50}
              step={1}
              disabled={!effects.autoPan.enabled}
              className="flex-1"
            />
            <span className="font-mono text-xs text-muted-foreground w-12">
              {effects.autoPan.rate.toFixed(2)}Hz
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-12">Depth</span>
            <Slider
              value={[effects.autoPan.depth * 100]}
              onValueChange={([v]) =>
                onEffectsChange({ ...effects, autoPan: { ...effects.autoPan, depth: v / 100 } })
              }
              max={100}
              step={1}
              disabled={!effects.autoPan.enabled}
              className="flex-1"
            />
            <span className="font-mono text-xs text-muted-foreground w-8">
              {Math.round(effects.autoPan.depth * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
