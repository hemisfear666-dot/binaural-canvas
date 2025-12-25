import { PlaybackState } from '@/types/binaural';
import { formatTime } from '@/lib/utils';

interface StatusBarProps {
  status: string;
  playbackState: PlaybackState;
  currentTime: number;
  isIsochronic: boolean;
}

export function StatusBar({ status, playbackState, currentTime, isIsochronic }: StatusBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-10 bg-void-lighter/95 backdrop-blur border-t border-border flex items-center justify-between px-6 z-50">
      <div className="flex items-center gap-4">
        <div className={`status-dot ${playbackState === 'playing' ? 'playing' : 'ready'}`} />
        <span className="font-mono text-xs uppercase tracking-wider text-primary">
          {status}
        </span>
      </div>

      <div className="flex items-center gap-6">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          Mode: {isIsochronic ? 'Isochronic (Speakers)' : 'Binaural (Headphones)'}
        </span>
        <span className="font-mono text-sm text-foreground">
          {formatTime(currentTime)}
        </span>
      </div>
    </div>
  );
}
