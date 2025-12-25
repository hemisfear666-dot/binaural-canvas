export interface Section {
  id: string;
  name: string;
  duration: number; // in seconds
  carrier: number; // carrier frequency in Hz
  beat: number; // binaural beat frequency in Hz
  volume: number; // 0-1
  muted: boolean;
}

export interface Track {
  title: string;
  sections: Section[];
  masterVolume: number;
  isIsochronic: boolean;
}

export type PlaybackState = 'stopped' | 'playing' | 'paused';

export interface AudioState {
  playbackState: PlaybackState;
  currentTime: number;
  currentSectionIndex: number | null;
}
