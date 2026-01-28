import { useEffect, useRef, useCallback } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Copy, 
  Trash2, 
  Scissors, 
  RotateCcw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { ClipContextAction } from '@/types/daw';

interface TimelineContextMenuProps {
  x: number;
  y: number;
  clipId: string;
  isMuted: boolean;
  onAction: (action: ClipContextAction, clipId: string) => void;
  onClose: () => void;
}

export function TimelineContextMenu({
  x,
  y,
  clipId,
  isMuted,
  onAction,
  onClose,
}: TimelineContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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
  const adjustedY = Math.min(y, window.innerHeight - 300);

  const handleAction = useCallback((action: ClipContextAction) => {
    onAction(action, clipId);
    onClose();
  }, [clipId, onAction, onClose]);

  const menuItems: Array<{
    action: ClipContextAction;
    label: string;
    icon: React.ReactNode;
    shortcut?: string;
    danger?: boolean;
  }> = [
    {
      action: isMuted ? 'unmute' : 'mute',
      label: isMuted ? 'Unmute' : 'Mute',
      icon: isMuted ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />,
      shortcut: 'M',
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
          <button
            key={item.action}
            onClick={() => handleAction(item.action)}
            className={`
              w-full flex items-center justify-between px-3 py-2 text-sm
              transition-colors
              ${item.danger 
                ? 'text-destructive hover:bg-destructive/10' 
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
          </button>
        ))}
      </div>
    </div>
  );
}
