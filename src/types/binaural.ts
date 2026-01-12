export interface Section {
  id: string;
  name: string;
  duration: number; // in seconds
  carrier: number; // carrier frequency in Hz
  endCarrier?: number; // optional end frequency for ramping
  beat: number; // binaural beat frequency in Hz
  endBeat?: number; // optional end beat frequency for ramping
  rampEnabled?: boolean; // allow toggling ramp on/off without losing targets
  volume: number; // 0-1
  muted: boolean;
}


export type WaveformType = 'sine' | 'triangle' | 'sawtooth';
export type NoiseType = 'white' | 'pink' | 'brown';
export type AmbienceType = 'none' | 'rain' | 'forest' | 'drone' | 'windchimes' | 'gongs';

export interface NoiseSettings {
  type: NoiseType;
  volume: number; // 0-1
  enabled: boolean;
}

export interface AmbienceSettings {
  type: AmbienceType;
  volume: number; // 0-1
  enabled: boolean;
}

export interface EffectsSettings {
  reverb: {
    enabled: boolean;
    amount: number;
  };
  lowpass: {
    enabled: boolean;
    frequency: number;
  };
  autoPan: {
    enabled: boolean;
    rate: number;
    depth: number;
  };
}

export interface Track {
  title: string;
  sections: Section[];
  masterVolume: number;
  isIsochronic: boolean;
  bpm: number;
  waveform: WaveformType;
  noise: NoiseSettings;
  ambience: AmbienceSettings;
  effects: EffectsSettings;
}

export type PlaybackState = 'stopped' | 'playing' | 'paused';

export interface AudioState {
  playbackState: PlaybackState;
  currentTime: number;
  currentSectionIndex: number | null;
}
