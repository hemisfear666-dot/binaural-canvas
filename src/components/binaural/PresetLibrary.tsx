import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Zap, Moon, Brain, Sparkles, Heart } from 'lucide-react';
import { Section } from '@/types/binaural';

interface Preset {
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  beat: number;
  carrier: number;
  duration: number;
}

const presets: Preset[] = [
  {
    name: 'Delta - Deep Sleep',
    description: '0.5-4Hz • Restorative sleep, healing',
    icon: <Moon className="h-4 w-4" />,
    color: 'text-purple-400',
    beat: 2,
    carrier: 100,
    duration: 300,
  },
  {
    name: 'Theta - Meditation',
    description: '4-8Hz • Deep relaxation, creativity',
    icon: <Heart className="h-4 w-4" />,
    color: 'text-primary',
    beat: 6,
    carrier: 150,
    duration: 180,
  },
  {
    name: 'Alpha - Relaxation',
    description: '8-12Hz • Calm focus, stress relief',
    icon: <Sparkles className="h-4 w-4" />,
    color: 'text-green-400',
    beat: 10,
    carrier: 200,
    duration: 120,
  },
  {
    name: 'Beta - Alertness',
    description: '12-30Hz • Active thinking, concentration',
    icon: <Brain className="h-4 w-4" />,
    color: 'text-yellow-400',
    beat: 20,
    carrier: 250,
    duration: 90,
  },
  {
    name: 'Gamma - Focus',
    description: '30-100Hz • Peak awareness, learning',
    icon: <Zap className="h-4 w-4" />,
    color: 'text-accent',
    beat: 40,
    carrier: 300,
    duration: 60,
  },
];

interface PresetLibraryProps {
  onAddPreset: (section: Omit<Section, 'id'>) => void;
}

export function PresetLibrary({ onAddPreset }: PresetLibraryProps) {
  const handleSelect = (preset: Preset) => {
    onAddPreset({
      name: preset.name,
      duration: preset.duration,
      carrier: preset.carrier,
      beat: preset.beat,
      volume: 0.8,
      muted: false,
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="border-accent/50 text-accent hover:bg-accent/10 hover:border-accent"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Presets
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-void-surface border-accent/30 p-2" align="start">
        <div className="space-y-1">
          <h4 className="text-xs uppercase tracking-widest text-accent font-medium px-2 py-1">
            Brainwave Presets
          </h4>
          {presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handleSelect(preset)}
              className="w-full text-left p-3 rounded-md hover:bg-accent/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className={`${preset.color}`}>{preset.icon}</div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                    {preset.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {preset.description}
                  </div>
                </div>
                <div className="text-xs font-mono text-accent/70">
                  {preset.beat}Hz
                </div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
