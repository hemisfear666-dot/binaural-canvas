import { useState, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Waves, Trees, Cloud, Volume2, Play, Square, Bell, Fan, Sparkles } from 'lucide-react';
import { NoiseType, AmbienceType, AmbientMusicType, NoiseSettings, AmbienceSettings, AmbientMusicSettings } from '@/types/binaural';
import { toast } from 'sonner';

interface AudioLayersCompactProps {
  noise: NoiseSettings;
  ambience: AmbienceSettings;
  ambientMusic: AmbientMusicSettings;
  onNoiseChange: (noise: NoiseSettings) => void;
  onAmbienceChange: (ambience: AmbienceSettings) => void;
  onAmbientMusicChange: (ambientMusic: AmbientMusicSettings) => void;
  onPreviewNoise?: (type: NoiseType) => void;
  onStopPreviewNoise?: () => void;
  onPreviewAmbience?: (type: AmbienceType) => void;
  onStopPreviewAmbience?: () => void;
  onPreviewAmbientMusic?: (type: AmbientMusicType) => void;
  onStopPreviewAmbientMusic?: () => void;
}

function LayerControl({
  icon,
  label,
  enabled,
  onToggle,
  volume,
  onVolumeChange,
  isPreviewing,
  onPreview,
  children,
  color = 'primary'
}: {
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  isPreviewing: boolean;
  onPreview: () => void;
  children?: React.ReactNode;
  color?: 'primary' | 'accent';
}) {
  const volumePct = Math.round(volume * 100);
  
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-void/30 border border-border/20">
      <div className={`${enabled ? (color === 'primary' ? 'text-primary' : 'text-accent') : 'text-muted-foreground'}`}>
        {icon}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </span>
          {children}
        </div>
        <div className={`flex items-center gap-2 ${!enabled && !isPreviewing ? 'opacity-50' : ''}`}>
          <Slider
            value={[volumePct]}
            onValueChange={([v]) => onVolumeChange(v / 100)}
            max={100}
            step={1}
            className="flex-1"
          />
          <span className="font-mono text-[10px] text-muted-foreground w-7 text-right">
            {volumePct}%
          </span>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onPreview}
        className={`h-6 w-6 shrink-0 ${isPreviewing ? 'text-accent bg-accent/20' : 'text-muted-foreground hover:text-primary'}`}
      >
        {isPreviewing ? <Square className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
      </Button>

      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        className={`shrink-0 scale-75 ${color === 'primary' ? 'data-[state=checked]:bg-primary' : 'data-[state=checked]:bg-accent'}`}
      />
    </div>
  );
}

export function AudioLayersCompact({
  noise,
  ambience,
  ambientMusic,
  onNoiseChange,
  onAmbienceChange,
  onAmbientMusicChange,
  onPreviewNoise,
  onStopPreviewNoise,
  onPreviewAmbience,
  onStopPreviewAmbience,
  onPreviewAmbientMusic,
  onStopPreviewAmbientMusic
}: AudioLayersCompactProps) {
  const [previewingNoise, setPreviewingNoise] = useState(false);
  const [previewingAmbience, setPreviewingAmbience] = useState(false);
  const [previewingAmbientMusic, setPreviewingAmbientMusic] = useState(false);

  const handleNoisePreview = useCallback(() => {
    if (previewingNoise) {
      onStopPreviewNoise?.();
      setPreviewingNoise(false);
    } else {
      onPreviewNoise?.(noise.type);
      setPreviewingNoise(true);
    }
  }, [previewingNoise, noise.type, onPreviewNoise, onStopPreviewNoise]);

  const handleAmbiencePreview = useCallback(() => {
    if (previewingAmbience) {
      onStopPreviewAmbience?.();
      setPreviewingAmbience(false);
    } else if (ambience.type !== 'none') {
      onPreviewAmbience?.(ambience.type);
      setPreviewingAmbience(true);
    }
  }, [previewingAmbience, ambience.type, onPreviewAmbience, onStopPreviewAmbience]);

  const handleAmbientMusicPreview = useCallback(() => {
    if (previewingAmbientMusic) {
      onStopPreviewAmbientMusic?.();
      setPreviewingAmbientMusic(false);
    } else {
      onPreviewAmbientMusic?.(ambientMusic.type);
      setPreviewingAmbientMusic(true);
    }
  }, [previewingAmbientMusic, ambientMusic.type, onPreviewAmbientMusic, onStopPreviewAmbientMusic]);

  const handleNoiseToggle = useCallback((enabled: boolean) => {
    onNoiseChange({ ...noise, enabled });
    toast(enabled ? 'Noise enabled' : 'Noise disabled', { duration: 1500 });
  }, [noise, onNoiseChange]);

  const handleAmbienceToggle = useCallback((enabled: boolean) => {
    onAmbienceChange({ ...ambience, enabled });
    toast(enabled ? 'Soundscape enabled' : 'Soundscape disabled', { duration: 1500 });
  }, [ambience, onAmbienceChange]);

  const handleAmbientMusicToggle = useCallback((enabled: boolean) => {
    onAmbientMusicChange({ ...ambientMusic, enabled });
    toast(enabled ? 'Ambience enabled' : 'Ambience disabled', { duration: 1500 });
  }, [ambientMusic, onAmbientMusicChange]);

  return (
    <div className="panel rounded-lg p-3 space-y-2">
      <h3 className="text-xs uppercase tracking-widest font-medium text-slate-400 mb-2">
        Layers
      </h3>

      {/* Noise Layer */}
      <LayerControl
        icon={<Waves className="h-3.5 w-3.5" />}
        label="Noise"
        enabled={noise.enabled}
        onToggle={handleNoiseToggle}
        volume={noise.volume}
        onVolumeChange={(v) => onNoiseChange({ ...noise, volume: v })}
        isPreviewing={previewingNoise}
        onPreview={handleNoisePreview}
      >
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
          <SelectTrigger className="h-5 w-16 bg-void border-border text-[10px] px-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="white" className="text-xs">White</SelectItem>
            <SelectItem value="pink" className="text-xs">Pink</SelectItem>
            <SelectItem value="brown" className="text-xs">Brown</SelectItem>
          </SelectContent>
        </Select>
      </LayerControl>

      {/* Soundscape Layer */}
      <LayerControl
        icon={<Trees className="h-3.5 w-3.5" />}
        label="Soundscape"
        enabled={ambience.enabled}
        onToggle={handleAmbienceToggle}
        volume={ambience.volume}
        onVolumeChange={(v) => onAmbienceChange({ ...ambience, volume: v })}
        isPreviewing={previewingAmbience}
        onPreview={handleAmbiencePreview}
        color="accent"
      >
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
          <SelectTrigger className="h-5 w-20 bg-void border-border text-[10px] px-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-xs">None</SelectItem>
            <SelectItem value="rain" className="text-xs">
              <span className="flex items-center gap-1"><Cloud className="h-2.5 w-2.5" />Rain</span>
            </SelectItem>
            <SelectItem value="forest" className="text-xs">
              <span className="flex items-center gap-1"><Trees className="h-2.5 w-2.5" />Forest</span>
            </SelectItem>
            <SelectItem value="ocean" className="text-xs">
              <span className="flex items-center gap-1"><Waves className="h-2.5 w-2.5" />Ocean</span>
            </SelectItem>
            <SelectItem value="drone" className="text-xs">Drone</SelectItem>
            <SelectItem value="windchimes" className="text-xs">
              <span className="flex items-center gap-1"><Bell className="h-2.5 w-2.5" />Chimes</span>
            </SelectItem>
            <SelectItem value="gongs" className="text-xs">Gongs</SelectItem>
            <SelectItem value="fan" className="text-xs">
              <span className="flex items-center gap-1"><Fan className="h-2.5 w-2.5" />Fan</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </LayerControl>

      {/* Ambience Layer */}
      <LayerControl
        icon={<Sparkles className="h-3.5 w-3.5" />}
        label="Ambience"
        enabled={ambientMusic.enabled}
        onToggle={handleAmbientMusicToggle}
        volume={ambientMusic.volume}
        onVolumeChange={(v) => onAmbientMusicChange({ ...ambientMusic, volume: v })}
        isPreviewing={previewingAmbientMusic}
        onPreview={handleAmbientMusicPreview}
      >
        <Select 
          value={ambientMusic.type} 
          onValueChange={(type: AmbientMusicType) => {
            onAmbientMusicChange({ ...ambientMusic, type });
            if (previewingAmbientMusic) {
              onStopPreviewAmbientMusic?.();
              setTimeout(() => onPreviewAmbientMusic?.(type), 50);
            }
          }}
        >
          <SelectTrigger className="h-5 w-20 bg-void border-border text-[10px] px-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="soothing" className="text-xs">Soothing</SelectItem>
            <SelectItem value="focus" className="text-xs">Focus</SelectItem>
            <SelectItem value="sleep" className="text-xs">Sleep</SelectItem>
          </SelectContent>
        </Select>
      </LayerControl>
    </div>
  );
}
