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

const shortcuts: ShortcutItem[] = [
  { keys: ['Space'], description: 'Play / Pause' },
  { keys: ['S'], description: 'Stop & Reset' },
  { keys: ['L'], description: 'Cycle Loop Mode' },
  { keys: ['←'], description: 'Skip back 5 seconds' },
  { keys: ['→'], description: 'Skip forward 5 seconds' },
  { keys: ['Shift', '←'], description: 'Previous section' },
  { keys: ['Shift', '→'], description: 'Next section' },
  { keys: ['Ctrl/⌘', 'Z'], description: 'Undo' },
  { keys: ['Ctrl/⌘', 'Shift', 'Z'], description: 'Redo' },
  { keys: ['Ctrl/⌘', 'A'], description: 'Select all sections' },
  { keys: ['Delete'], description: 'Delete selected sections' },
  { keys: ['Ctrl/⌘', 'D'], description: 'Duplicate selected section' },
  { keys: ['Escape'], description: 'Deselect all' },
  { keys: ['+'], description: 'Zoom in timeline' },
  { keys: ['-'], description: 'Zoom out timeline' },
  { keys: ['?'], description: 'Show this help' },
];

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
            onDeleteSelected();
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
      <DialogContent className="bg-void-surface border-accent/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-accent" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-4">
          {shortcuts.map((shortcut, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-accent/5 transition-colors"
            >
              <span className="text-sm text-foreground/80">
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, j) => (
                  <span key={j}>
                    <kbd className="px-2 py-1 text-xs font-mono bg-void border border-accent/30 rounded text-accent">
                      {key}
                    </kbd>
                    {j < shortcut.keys.length - 1 && (
                      <span className="text-muted-foreground mx-1">+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
