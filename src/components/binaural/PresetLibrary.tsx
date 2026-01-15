import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Zap, Moon, Brain, Sparkles, Heart, Star, Trash2, Search } from 'lucide-react';
import { Section } from '@/types/binaural';
import { CustomPreset } from '@/hooks/useCustomPresets';

interface Preset {
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  beat: number;
  carrier: number;
  duration: number;
}

const builtInPresets: Preset[] = [
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
  customPresets: CustomPreset[];
  onDeleteCustomPreset: (id: string) => void;
  onSaveAsPreset?: (section: Section, name: string) => void;
}

export function PresetLibrary({ onAddPreset, customPresets, onDeleteCustomPreset }: PresetLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  const handleSelectBuiltIn = (preset: Preset) => {
    onAddPreset({
      name: preset.name,
      duration: preset.duration,
      carrier: preset.carrier,
      beat: preset.beat,
      volume: 0.8,
      muted: false,
    });
    setOpen(false);
  };

  const handleSelectCustom = (preset: CustomPreset) => {
    onAddPreset({
      name: preset.name,
      duration: preset.duration,
      carrier: preset.carrier,
      endCarrier: preset.endCarrier,
      beat: preset.beat,
      endBeat: preset.endBeat,
      rampEnabled: preset.rampEnabled,
      volume: 0.8,
      muted: false,
    });
    setOpen(false);
  };

  const filteredBuiltIn = builtInPresets.filter(
    (p) => p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustom = customPresets.filter(
    (p) => p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="border-accent/50 text-accent hover:bg-accent/10 hover:border-accent"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Presets
          {customPresets.length > 0 && (
            <span className="ml-1.5 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
              +{customPresets.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-void-surface border-accent/30 p-2" align="start">
        <div className="space-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search presets..."
              className="h-8 pl-7 bg-void border-border text-xs"
            />
          </div>

          <ScrollArea className="h-[320px]">
            <div className="space-y-1 pr-2">
              {/* Built-in Presets */}
              <h4 className="text-[10px] uppercase tracking-widest text-accent font-medium px-2 py-1.5 sticky top-0 bg-void-surface">
                Brainwave Presets
              </h4>
              {filteredBuiltIn.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handleSelectBuiltIn(preset)}
                  className="w-full text-left p-2.5 rounded-md hover:bg-accent/10 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`${preset.color}`}>{preset.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground group-hover:text-accent transition-colors truncate">
                        {preset.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {preset.description}
                      </div>
                    </div>
                    <div className="text-xs font-mono text-accent/70 shrink-0">
                      {preset.beat}Hz
                    </div>
                  </div>
                </button>
              ))}

              {/* Custom Presets */}
              {customPresets.length > 0 && (
                <>
                  <h4 className="text-[10px] uppercase tracking-widest text-primary font-medium px-2 py-1.5 mt-2 sticky top-0 bg-void-surface flex items-center gap-1.5">
                    <Star className="h-3 w-3" />
                    Your Presets ({customPresets.length})
                  </h4>
                  {filteredCustom.length === 0 && searchQuery && (
                    <div className="text-xs text-muted-foreground px-2 py-3 text-center">
                      No matching custom presets
                    </div>
                  )}
                  {filteredCustom.map((preset) => (
                    <div
                      key={preset.id}
                      className="w-full p-2.5 rounded-md hover:bg-primary/10 transition-colors group flex items-center gap-2"
                    >
                      <button
                        onClick={() => handleSelectCustom(preset)}
                        className="flex-1 text-left flex items-center gap-3 min-w-0"
                      >
                        <Star className="h-4 w-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                            {preset.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {preset.carrier}Hz carrier • {preset.duration}s
                            {preset.rampEnabled && preset.endBeat !== undefined && (
                              <span className="ml-1 text-accent">→ {preset.endBeat}Hz</span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs font-mono text-primary/70 shrink-0">
                          {preset.beat}Hz
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCustomPreset(preset.id);
                        }}
                        className="h-6 w-6 text-muted-foreground hover:text-accent hover:bg-accent/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </>
              )}

              {filteredBuiltIn.length === 0 && filteredCustom.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-6 text-center">
                  No presets found
                </div>
              )}
            </div>
          </ScrollArea>

          {customPresets.length > 0 && (
            <div className="text-[9px] text-muted-foreground text-center pt-1 border-t border-border">
              Save sections as presets using ★ in sequence editor
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Dialog component for naming a preset before saving
interface SavePresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  onSave: (name: string) => void;
}

export function SavePresetDialog({ open, onOpenChange, defaultName, onSave }: SavePresetDialogProps) {
  const [name, setName] = useState(defaultName);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-void-surface border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Save as Preset
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Preset name..."
            className="bg-void border-border"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
          />
          <p className="text-xs text-muted-foreground">
            This will save the section's frequencies, duration, and ramp settings.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Save Preset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
