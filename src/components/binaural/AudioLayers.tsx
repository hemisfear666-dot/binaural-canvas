import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Waves, Trees, Cloud, Volume2, Play, Square } from 'lucide-react';
import { NoiseType, AmbienceType, NoiseSettings, AmbienceSettings } from '@/types/binaural';

interface AudioLayersProps {
  noise: NoiseSettings;
  ambience: AmbienceSettings;
  onNoiseChange: (noise: NoiseSettings) => void;
  onAmbienceChange: (ambience: AmbienceSettings) => void;
  onPreviewNoise?: (type: NoiseType) => void;
  onStopPreviewNoise?: () => void;
  onPreviewAmbience?: (type: AmbienceType) => void;
  onStopPreviewAmbience?: () => void;
}

export function AudioLayers({
  noise,
  ambience,
  onNoiseChange,
  onAmbienceChange,
  onPreviewNoise,
  onStopPreviewNoise,
  onPreviewAmbience,
  onStopPreviewAmbience,
}: AudioLayersProps) {
  const [previewingNoise, setPreviewingNoise] = useState(false);
  const [previewingAmbience, setPreviewingAmbience] = useState(false);

  const noisePct = Math.round(((typeof noise.volume === 'number' && Number.isFinite(noise.volume)) ? noise.volume : 0) * 100);
  const ambiencePct = Math.round(((typeof ambience.volume === 'number' && Number.isFinite(ambience.volume)) ? ambience.volume : 0) * 100);

  const handleNoisePreview = () => {
    if (previewingNoise) {
      onStopPreviewNoise?.();
      setPreviewingNoise(false);
    } else {
      onPreviewNoise?.(noise.type);
      setPreviewingNoise(true);
    }
  };

  const handleAmbiencePreview = () => {
    if (previewingAmbience) {
      onStopPreviewAmbience?.();
      setPreviewingAmbience(false);
    } else {
      if (ambience.type !== 'none') {
        onPreviewAmbience?.(ambience.type);
        setPreviewingAmbience(true);
      }
    }
  };

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
          <div className="flex items-center gap-2">
            {onPreviewNoise && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNoisePreview}
                className={`h-6 w-6 ${previewingNoise ? 'text-accent bg-accent/20' : 'text-muted-foreground hover:text-primary'}`}
                title={previewingNoise ? 'Stop preview' : 'Preview noise'}
              >
                {previewingNoise ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </Button>
            )}
            <Switch
              checked={noise.enabled}
              onCheckedChange={(enabled) => onNoiseChange({ ...noise, enabled })}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        </div>

        <div className={`space-y-2 ${!noise.enabled && !previewingNoise ? 'opacity-50' : ''}`}>
          <Select
            value={noise.type}
            onValueChange={(type: NoiseType) => {
              onNoiseChange({ ...noise, type });
              if (previewingNoise) {
                onStopPreviewNoise?.();
                setTimeout(() => onPreviewNoise?.(type), 50);
              }
            }}
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
              value={[noisePct]}
              onValueChange={([v]) => onNoiseChange({ ...noise, volume: v / 100 })}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="font-mono text-xs text-muted-foreground w-8">
              {noisePct}%
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
          <div className="flex items-center gap-2">
            {onPreviewAmbience && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleAmbiencePreview}
                disabled={ambience.type === 'none' && !previewingAmbience}
                className={`h-6 w-6 ${previewingAmbience ? 'text-accent bg-accent/20' : 'text-muted-foreground hover:text-primary'} disabled:opacity-30`}
                title={previewingAmbience ? 'Stop preview' : 'Preview soundscape'}
              >
                {previewingAmbience ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </Button>
            )}
            <Switch
              checked={ambience.enabled}
              onCheckedChange={(enabled) => onAmbienceChange({ ...ambience, enabled })}
              className="data-[state=checked]:bg-accent"
            />
          </div>
        </div>

        <div className={`space-y-2 ${!ambience.enabled && !previewingAmbience ? 'opacity-50' : ''}`}>
          <Select
            value={ambience.type}
            onValueChange={(type: AmbienceType) => {
              onAmbienceChange({ ...ambience, type });
              if (previewingAmbience && type !== 'none') {
                onStopPreviewAmbience?.();
                setTimeout(() => onPreviewAmbience?.(type), 50);
              } else if (type === 'none') {
                onStopPreviewAmbience?.();
                setPreviewingAmbience(false);
              }
            }}
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
              value={[ambiencePct]}
              onValueChange={([v]) => onAmbienceChange({ ...ambience, volume: v / 100 })}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="font-mono text-xs text-muted-foreground w-8">
              {ambiencePct}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
