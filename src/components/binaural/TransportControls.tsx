import { Button } from '@/components/ui/button';
import { Play, Pause, Square, SkipBack } from 'lucide-react';
import { PlaybackState } from '@/types/binaural';
import { formatTime } from '@/lib/utils';

interface TransportControlsProps {
  playbackState: PlaybackState;
  currentTime: number;
  totalDuration: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}

export function TransportControls({
  playbackState,
  currentTime,
  totalDuration,
  onPlay,
  onPause,
  onStop,
}: TransportControlsProps) {
  return (
    <div className="flex items-center gap-2 sm:gap-4">
      {/* Time Display */}
      <div className="flex items-center gap-1 sm:gap-2 font-mono text-sm sm:text-lg">
        <span className="text-primary">{formatTime(currentTime)}</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">{formatTime(totalDuration)}</span>
      </div>

      {/* Transport Buttons */}
      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onStop}
          className="h-8 w-8 sm:h-10 sm:w-10 border-border hover:border-accent hover:text-accent"
        >
          <SkipBack className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={onStop}
          disabled={playbackState === 'stopped'}
          className="h-8 w-8 sm:h-10 sm:w-10 border-border hover:border-accent hover:bg-accent/10 hover:text-accent disabled:opacity-30"
        >
          <Square className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>

        {playbackState === 'playing' ? (
          <Button
            variant="default"
            size="icon"
            onClick={onPause}
            className="h-10 w-10 sm:h-12 sm:w-12 bg-primary hover:bg-primary-glow glow-blue"
          >
            <Pause className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        ) : (
          <Button
            variant="default"
            size="icon"
            onClick={onPlay}
            className="h-10 w-10 sm:h-12 sm:w-12 bg-primary hover:bg-primary-glow glow-blue"
          >
            <Play className="h-4 w-4 sm:h-5 sm:w-5 ml-0.5" />
          </Button>
        )}
      </div>

      {/* Status Indicator - Hidden on mobile */}
      <div className="hidden sm:flex items-center gap-2">
        <div
          className={`status-dot ${
            playbackState === 'playing'
              ? 'playing'
              : playbackState === 'stopped'
              ? 'ready'
              : 'stopped'
          }`}
        />
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          {playbackState === 'playing'
            ? 'Playing'
            : playbackState === 'paused'
            ? 'Paused'
            : 'Ready'}
        </span>
      </div>
    </div>
  );
}