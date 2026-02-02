import { useEffect, useRef, useCallback, useState } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Copy, 
  Trash2, 
  Scissors, 
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AudioWaveform,
  Check,
  TrendingUp
} from 'lucide-react';
import { ClipContextAction } from '@/types/daw';
import { WaveformType } from '@/types/binaural';

interface TimelineContextMenuProps {
  x: number;
  y: number;
  clipId: string;
  isMuted: boolean;
  currentWaveform: WaveformType;
  hasRamp: boolean;
  onAction: (action: ClipContextAction, clipId: string) => void;
  onClose: () => void;
}

export function TimelineContextMenu({
  x,
  y,
  clipId,
  isMuted,
  currentWaveform,
  hasRamp,
  onAction,
  onClose,
}: TimelineContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showWaveformSubmenu, setShowWaveformSubmenu] = useState(false);

  // Close on click outside or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position if menu would go off-screen
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 400);

  const handleAction = useCallback((action: ClipContextAction) => {
    onAction(action, clipId);
    onClose();
  }, [clipId, onAction, onClose]);

  const waveformOptions: { type: WaveformType; label: string; action: ClipContextAction }[] = [
    { type: 'sine', label: 'Sine', action: 'set-waveform-sine' },
    { type: 'triangle', label: 'Triangle', action: 'set-waveform-triangle' },
    { type: 'sawtooth', label: 'Sawtooth', action: 'set-waveform-sawtooth' },
  ];

  const menuItems: Array<{
    action?: ClipContextAction;
    label: string;
    icon: React.ReactNode;
    shortcut?: string;
    danger?: boolean;
    hasSubmenu?: boolean;
    highlight?: boolean;
    onHover?: () => void;
  }> = [
    {
      action: isMuted ? 'unmute' : 'mute',
      label: isMuted ? 'Unmute' : 'Mute',
      icon: isMuted ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />,
      shortcut: 'M',
    },
    {
      label: 'Waveform',
      icon: <AudioWaveform className="h-3.5 w-3.5" />,
      hasSubmenu: true,
      onHover: () => setShowWaveformSubmenu(true),
    },
    {
      action: 'ramp-to',
      label: hasRamp ? 'Edit Ramp' : 'Ramp To...',
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      shortcut: 'R',
      highlight: hasRamp,
    },
    {
      action: 'duplicate',
      label: 'Duplicate',
      icon: <Copy className="h-3.5 w-3.5" />,
      shortcut: 'Ctrl+D',
    },
    {
      action: 'split',
      label: 'Split at Cursor',
      icon: <Scissors className="h-3.5 w-3.5" />,
      shortcut: 'S',
    },
    {
      action: 'trim-start',
      label: 'Trim Start',
      icon: <ChevronRight className="h-3.5 w-3.5" />,
    },
    {
      action: 'trim-end',
      label: 'Trim End',
      icon: <ChevronLeft className="h-3.5 w-3.5" />,
    },
    {
      action: 'reset-duration',
      label: 'Reset Duration',
      icon: <RotateCcw className="h-3.5 w-3.5" />,
    },
    {
      action: 'delete',
      label: 'Delete',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      shortcut: 'Del',
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[180px] rounded-lg border border-border bg-popover shadow-xl animate-scale-in"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div className="py-1">
        {menuItems.map((item, index) => (
          <div 
            key={item.label} 
            className="relative"
            onMouseEnter={item.hasSubmenu ? item.onHover : () => setShowWaveformSubmenu(false)}
          >
            <button
              onClick={() => item.action && handleAction(item.action)}
              className={`
                w-full flex items-center justify-between px-3 py-2 text-sm
                transition-colors
                ${item.danger 
                  ? 'text-destructive hover:bg-destructive/10' 
                  : item.highlight
                    ? 'text-accent hover:bg-accent/10'
                    : 'text-foreground hover:bg-muted'
                }
                ${index === menuItems.length - 1 ? 'border-t border-border mt-1 pt-2' : ''}
              `}
            >
              <span className="flex items-center gap-2">
                {item.icon}
                {item.label}
              </span>
              {item.shortcut && (
                <span className="text-xs text-muted-foreground font-mono">
                  {item.shortcut}
                </span>
              )}
              {item.hasSubmenu && (
                <ChevronDown className="h-3 w-3 text-muted-foreground -rotate-90" />
              )}
            </button>

            {/* Waveform Submenu */}
            {item.hasSubmenu && showWaveformSubmenu && (
              <div 
                className="absolute left-full top-0 ml-1 min-w-[140px] rounded-lg border border-border bg-popover shadow-xl"
                onMouseLeave={() => setShowWaveformSubmenu(false)}
              >
                <div className="py-1">
                  {waveformOptions.map((wf) => (
                    <button
                      key={wf.type}
                      onClick={() => handleAction(wf.action)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        {wf.type === 'sine' && (
                          <svg className="h-3 w-6" viewBox="0 0 24 12">
                            <path d="M0 6 Q6 0 12 6 Q18 12 24 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                        )}
                        {wf.type === 'triangle' && (
                          <svg className="h-3 w-6" viewBox="0 0 24 12">
                            <path d="M0 6 L6 0 L18 12 L24 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                        )}
                        {wf.type === 'sawtooth' && (
                          <svg className="h-3 w-6" viewBox="0 0 24 12">
                            <path d="M0 12 L12 0 L12 12 L24 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                        )}
                        {wf.label}
                      </span>
                      {currentWaveform === wf.type && (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}