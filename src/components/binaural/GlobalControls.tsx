import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Volume2, Headphones, Speaker } from 'lucide-react';

interface GlobalControlsProps {
  masterVolume: number;
  onVolumeChange: (value: number) => void;
  isIsochronic: boolean;
  onModeChange: (value: boolean) => void;
}

export function GlobalControls({
  masterVolume,
  onVolumeChange,
  isIsochronic,
  onModeChange,
}: GlobalControlsProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-6 p-3 sm:p-4 panel rounded-lg">
      {/* Master Volume */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Label className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Master
          </Label>
        </div>
        <Slider
          value={[masterVolume * 100]}
          onValueChange={([v]) => onVolumeChange(v / 100)}
          max={100}
          step={1}
          className="w-24 sm:w-32"
        />
        <span className="font-mono text-sm text-primary w-12">
          {Math.round(masterVolume * 100)}%
        </span>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <Headphones className={`h-4 w-4 transition-colors ${!isIsochronic ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={`text-xs uppercase tracking-wide transition-colors ${!isIsochronic ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
            Binaural
          </span>
        </div>
        
        <Switch
          checked={isIsochronic}
          onCheckedChange={onModeChange}
          className="data-[state=checked]:bg-accent"
        />
        
        <div className="flex items-center gap-2">
          <Speaker className={`h-4 w-4 transition-colors ${isIsochronic ? 'text-accent' : 'text-muted-foreground'}`} />
          <span className={`text-xs uppercase tracking-wide transition-colors ${isIsochronic ? 'text-accent font-medium' : 'text-muted-foreground'}`}>
            Isochronic
          </span>
        </div>
      </div>
    </div>
  );
}