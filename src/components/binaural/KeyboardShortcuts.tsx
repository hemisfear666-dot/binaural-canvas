import { useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Keyboard } from 'lucide-react';

interface ShortcutItem {
  keys: string[];
  description: string;
}

// Split shortcuts into two columns for better layout
const shortcutsLeft: ShortcutItem[] = [
  { keys: ['Space'], description: 'Play / Pause' },
  { keys: ['S'], description: 'Stop & Reset' },
  { keys: ['L'], description: 'Cycle Loop Mode' },
  { keys: ['←'], description: 'Skip back 5s' },
  { keys: ['→'], description: 'Skip forward 5s' },
  { keys: ['⇧', '←'], description: 'Previous section' },
  { keys: ['⇧', '→'], description: 'Next section' },
  { keys: ['?'], description: 'Show this help' },
];

const shortcutsRight: ShortcutItem[] = [
  { keys: ['⌘', 'Z'], description: 'Undo' },
  { keys: ['⌘', '⇧', 'Z'], description: 'Redo' },
  { keys: ['⌘', 'A'], description: 'Select all' },
  { keys: ['⌘', 'D'], description: 'Duplicate' },
  { keys: ['Del'], description: 'Delete selected' },
  { keys: ['Esc'], description: 'Deselect all' },
  { keys: ['+'], description: 'Zoom in' },
  { keys: ['−'], description: 'Zoom out' },
];

// Shortcut row component for cleaner rendering
function ShortcutRow({ shortcut }: { shortcut: ShortcutItem }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-accent/5 transition-colors">
      <span className="text-xs text-foreground/70">{shortcut.description}</span>
      <div className="flex items-center gap-0.5">
        {shortcut.keys.map((key, j) => (
          <kbd
            key={j}
            className="min-w-[22px] h-5 px-1.5 text-[10px] font-mono bg-void/80 border border-accent/20 rounded text-accent flex items-center justify-center"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSkip: (seconds: number) => void;
  onNextSection: () => void;
  onPrevSection: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onDeselectAll: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCycleLoopMode: () => void;
  isPlaying: boolean;
  // Timeline clip operations
  hasSelectedClips?: boolean;
  onDeleteSelectedClips?: () => void;
}

export function KeyboardShortcuts({
  isOpen,
  onOpenChange,
  onPlay,
  onPause,
  onStop,
  onSkip,
  onNextSection,
  onPrevSection,
  onUndo,
  onRedo,
  onSelectAll,
  onDeleteSelected,
  onDuplicateSelected,
  onDeselectAll,
  onZoomIn,
  onZoomOut,
  onCycleLoopMode,
  isPlaying,
  hasSelectedClips = false,
  onDeleteSelectedClips,
}: KeyboardShortcutsProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          isPlaying ? onPause() : onPlay();
          break;
        case 'KeyS':
          if (!isMod) {
            e.preventDefault();
            onStop();
          }
          break;
        case 'KeyL':
          if (!isMod) {
            e.preventDefault();
            onCycleLoopMode();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            onPrevSection();
          } else {
            onSkip(-5);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            onNextSection();
          } else {
            onSkip(5);
          }
          break;
        case 'KeyZ':
          if (isMod) {
            e.preventDefault();
            if (e.shiftKey) {
              onRedo();
            } else {
              onUndo();
            }
          }
          break;
        case 'KeyA':
          if (isMod) {
            e.preventDefault();
            onSelectAll();
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (!isMod) {
            e.preventDefault();
            // Prioritize timeline clip deletion if clips are selected
            if (hasSelectedClips && onDeleteSelectedClips) {
              onDeleteSelectedClips();
            } else {
              onDeleteSelected();
            }
          }
          break;
        case 'KeyD':
          if (isMod) {
            e.preventDefault();
            onDuplicateSelected();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onDeselectAll();
          break;
        case 'Equal':
        case 'NumpadAdd':
          e.preventDefault();
          onZoomIn();
          break;
        case 'Minus':
        case 'NumpadSubtract':
          e.preventDefault();
          onZoomOut();
          break;
        case 'Slash':
          if (e.shiftKey) {
            e.preventDefault();
            onOpenChange(true);
          }
          break;
      }
    },
    [
      isPlaying,
      onPlay,
      onPause,
      onStop,
      onSkip,
      onNextSection,
      onPrevSection,
      onUndo,
      onRedo,
      onSelectAll,
      onDeleteSelected,
      onDuplicateSelected,
      onDeselectAll,
      onZoomIn,
      onZoomOut,
      onCycleLoopMode,
      onOpenChange,
      hasSelectedClips,
      onDeleteSelectedClips,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 md:h-8 px-1.5 md:px-2 text-muted-foreground hover:text-[#000512] hover:bg-accent border border-transparent hover:border-accent/50"
        >
          <Keyboard className="h-3.5 w-3.5 md:mr-1.5" />
          <span className="hidden md:inline text-xs">Shortcuts</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-void/95 backdrop-blur-xl border-accent/20 max-w-2xl shadow-2xl shadow-accent/10">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-accent" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6 mt-4">
          {/* Left column - Playback */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2 block">Playback</span>
            {shortcutsLeft.map((shortcut, i) => (
              <ShortcutRow key={i} shortcut={shortcut} />
            ))}
          </div>
          {/* Right column - Editing */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2 block">Editing</span>
            {shortcutsRight.map((shortcut, i) => (
              <ShortcutRow key={i} shortcut={shortcut} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
