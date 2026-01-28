import { useEffect, useState } from 'react';

interface MetronomeDebugProps {
  bpm: number;
  metronomeEnabled: boolean;
  playbackState: 'stopped' | 'playing' | 'paused';
  audioContext: AudioContext | null;
}

export function MetronomeDebug({
  bpm,
  metronomeEnabled,
  playbackState,
  audioContext,
}: MetronomeDebugProps) {
  const [ctxState, setCtxState] = useState<string>('n/a');
  const [ctxTime, setCtxTime] = useState<number>(0);

  useEffect(() => {
    if (!audioContext) {
      setCtxState('no context');
      setCtxTime(0);
      return;
    }

    const update = () => {
      setCtxState(audioContext.state);
      setCtxTime(audioContext.currentTime);
    };

    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [audioContext]);

  const secondsPerBeat = 60 / Math.max(20, Math.min(300, bpm));
  const metronomeShouldRun = metronomeEnabled && playbackState === 'playing';

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-void-surface/95 border border-border rounded-lg p-3 text-xs font-mono space-y-1 shadow-lg backdrop-blur-sm max-w-xs">
      <div className="text-accent font-semibold mb-1">🔧 Metronome Debug</div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">BPM:</span>
        <span className="text-foreground">{bpm}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">sec/beat:</span>
        <span className="text-foreground">{secondsPerBeat.toFixed(3)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Metronome:</span>
        <span className={metronomeEnabled ? 'text-green-400' : 'text-red-400'}>
          {metronomeEnabled ? 'ON' : 'OFF'}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Playback:</span>
        <span className="text-foreground">{playbackState}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Should tick:</span>
        <span className={metronomeShouldRun ? 'text-green-400' : 'text-red-400'}>
          {metronomeShouldRun ? 'YES' : 'NO'}
        </span>
      </div>
      <div className="border-t border-border pt-1 mt-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Ctx state:</span>
          <span className={ctxState === 'running' ? 'text-green-400' : 'text-yellow-400'}>
            {ctxState}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Ctx time:</span>
          <span className="text-foreground">{ctxTime.toFixed(2)}s</span>
        </div>
      </div>
    </div>
  );
}
