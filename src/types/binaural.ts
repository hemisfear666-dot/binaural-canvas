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
export type AmbienceType = 'none' | 'rain' | 'forest' | 'drone' | 'windchimes' | 'gongs' | 'ocean' | 'fan';
export type AmbientMusicType = 'soothing' | 'focus' | 'sleep';

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

export interface AmbientMusicSettings {
  type: AmbientMusicType;
  volume: number; // 0-1
  enabled: boolean;
}

// Single effect settings for one target
export interface SingleEffectSettings {
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
  audio3d: {
    enabled: boolean;
    intensity: number; // 0-1
  };
  timeshift: {
    enabled: boolean;
    rate: number; // 0.5 to 5.0
  };
}

// Multi-target effects settings
export interface EffectsSettings {
  song: SingleEffectSettings;
  soundscape: SingleEffectSettings;
  noise: SingleEffectSettings;
  ambientMusic: SingleEffectSettings;
}

// Legacy single-target effects (for backwards compatibility during migration)
export interface LegacyEffectsSettings {
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

export type EffectsTarget = 'song' | 'soundscape' | 'noise' | 'ambientMusic';

export interface Track {
  title: string;
  sections: Section[];
  masterVolume: number;
  isIsochronic: boolean;
  bpm: number;
  waveform: WaveformType;
  noise: NoiseSettings;
  ambience: AmbienceSettings;
  ambientMusic: AmbientMusicSettings;
  effects: EffectsSettings;
}

export type PlaybackState = 'stopped' | 'playing' | 'paused';

export interface AudioState {
  playbackState: PlaybackState;
  currentTime: number;
  currentSectionIndex: number | null;
}
