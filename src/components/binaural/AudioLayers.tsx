import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Waves, Trees, Cloud, Volume2 } from 'lucide-react';
import { NoiseType, AmbienceType, NoiseSettings, AmbienceSettings } from '@/types/binaural';

interface AudioLayersProps {
  noise: NoiseSettings;
  ambience: AmbienceSettings;
  onNoiseChange: (noise: NoiseSettings) => void;
  onAmbienceChange: (ambience: AmbienceSettings) => void;
}

export function AudioLayers({
  noise,
  ambience,
  onNoiseChange,
  onAmbienceChange,
}: AudioLayersProps) {
  return (
    <div className="panel rounded-lg p-3 sm:p-4 space-y-4">
      <h3 className="text-xs uppercase tracking-widest text-accent font-medium">
        Background Layers
      </h3>

      {/* Noise Layer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-primary" />
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Noise
            </Label>
          </div>
          <Switch
            checked={noise.enabled}
            onCheckedChange={(enabled) => onNoiseChange({ ...noise, enabled })}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        <div className={`space-y-2 ${!noise.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <Select
            value={noise.type}
            onValueChange={(type: NoiseType) => onNoiseChange({ ...noise, type })}
          >
            <SelectTrigger className="h-8 bg-void border-border text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="white">White Noise</SelectItem>
              <SelectItem value="pink">Pink Noise</SelectItem>
              <SelectItem value="brown">Brown Noise</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
            <Slider
              value={[noise.volume * 100]}
              onValueChange={([v]) => onNoiseChange({ ...noise, volume: v / 100 })}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="font-mono text-xs text-muted-foreground w-8">
              {Math.round(noise.volume * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Ambience Layer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trees className="h-4 w-4 text-accent" />
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Soundscape
            </Label>
          </div>
          <Switch
            checked={ambience.enabled}
            onCheckedChange={(enabled) => onAmbienceChange({ ...ambience, enabled })}
            className="data-[state=checked]:bg-accent"
          />
        </div>

        <div className={`space-y-2 ${!ambience.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <Select
            value={ambience.type}
            onValueChange={(type: AmbienceType) => onAmbienceChange({ ...ambience, type })}
          >
            <SelectTrigger className="h-8 bg-void border-border text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="rain">
                <div className="flex items-center gap-2">
                  <Cloud className="h-3 w-3" />
                  Rain
                </div>
              </SelectItem>
              <SelectItem value="forest">
                <div className="flex items-center gap-2">
                  <Trees className="h-3 w-3" />
                  Forest
                </div>
              </SelectItem>
              <SelectItem value="drone">
                <div className="flex items-center gap-2">
                  <Waves className="h-3 w-3" />
                  Drone
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
            <Slider
              value={[ambience.volume * 100]}
              onValueChange={([v]) => onAmbienceChange({ ...ambience, volume: v / 100 })}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="font-mono text-xs text-muted-foreground w-8">
              {Math.round(ambience.volume * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
