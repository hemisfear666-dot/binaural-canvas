import { PlaybackState } from '@/types/binaural';
import { formatTime } from '@/lib/utils';

interface StatusBarProps {
  status: string;
  playbackState: PlaybackState;
  currentTime: number;
  isIsochronic: boolean;
}

const APP_VERSION = '0.7.0';

export function StatusBar({ status, playbackState, currentTime, isIsochronic }: StatusBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-12 md:h-10 bg-void-lighter/95 backdrop-blur border-t border-border flex items-center justify-between px-3 md:px-6 z-50">
      <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
        <div className={`status-dot shrink-0 ${playbackState === 'playing' ? 'playing' : 'ready'}`} />
        <span className="font-mono text-[10px] md:text-xs uppercase tracking-wider text-primary truncate">
          {status}
        </span>
      </div>

      <div className="flex items-center gap-3 md:gap-6 shrink-0">
        <span className="hidden sm:block text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">
          {isIsochronic ? 'ISO' : 'BIN'}
        </span>
        <span className="font-mono text-xs md:text-sm text-foreground">
          {formatTime(currentTime)}
        </span>
        <span className="font-mono text-[10px] md:text-xs text-accent font-medium">
          v{APP_VERSION}
        </span>
      </div>
    </div>
  );
}