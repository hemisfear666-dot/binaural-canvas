import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WaveformType } from '@/types/binaural';

interface WaveformSelectorProps {
  waveform: WaveformType;
  onWaveformChange: (waveform: WaveformType) => void;
}

export function WaveformSelector({ waveform, onWaveformChange }: WaveformSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground shrink-0">
        Wave
      </Label>
      <Select value={waveform} onValueChange={onWaveformChange}>
        <SelectTrigger className="h-8 w-24 bg-void border-border text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sine">
            <div className="flex items-center gap-2">
              <svg className="h-3 w-8" viewBox="0 0 32 12">
                <path
                  d="M0 6 Q8 0 16 6 Q24 12 32 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              Sine
            </div>
          </SelectItem>
          <SelectItem value="triangle">
            <div className="flex items-center gap-2">
              <svg className="h-3 w-8" viewBox="0 0 32 12">
                <path
                  d="M0 6 L8 0 L24 12 L32 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              Triangle
            </div>
          </SelectItem>
          <SelectItem value="sawtooth">
            <div className="flex items-center gap-2">
              <svg className="h-3 w-8" viewBox="0 0 32 12">
                <path
                  d="M0 12 L16 0 L16 12 L32 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              Sawtooth
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
