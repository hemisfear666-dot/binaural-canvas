// DAW Timeline Types - Multi-track arrangement

export interface TimelineClip {
  id: string;
  sectionId: string; // References the original Section definition
  trackId: string;
  startTime: number; // Start position in seconds
  duration: number; // Clip duration (can differ from original section duration)
  muted: boolean;
  // Visual only - doesn't affect audio
  color?: string;
}

export interface TimelineTrack {
  id: string;
  name: string;
  color: string; // HSL color for track header
  muted: boolean;
  solo: boolean;
  volume: number; // 0-1, track-level volume multiplier
}

export interface TimelineState {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  snapToGrid: boolean;
  gridSize: number; // Grid subdivision in seconds (e.g., 1 = 1 second grid)
  viewportStart: number; // Scroll position in seconds
  selectedClipIds: Set<string>;
  selectedTrackId: string | null;
}

export interface GridSettings {
  snapEnabled: boolean;
  gridSize: number; // seconds
  showGrid: boolean;
}

// Default track colors - DAW-style palette
export const TRACK_COLORS = [
  '204 70% 53%',   // Primary blue
  '0 85% 60%',     // Accent red
  '142 70% 45%',   // Green
  '280 70% 55%',   // Purple
  '35 90% 55%',    // Orange
  '180 70% 45%',   // Cyan
  '330 70% 55%',   // Pink
  '60 70% 45%',    // Yellow
] as const;

export const DEFAULT_GRID_SIZES = [
  { label: '0.5s', value: 0.5 },
  { label: '1s', value: 1 },
  { label: '2s', value: 2 },
  { label: '5s', value: 5 },
  { label: '10s', value: 10 },
  { label: 'Bar', value: 'bar' }, // Will be calculated from BPM
] as const;

// Context menu action types
export type ClipContextAction = 
  | 'mute'
  | 'unmute'
  | 'duplicate'
  | 'delete'
  | 'split'
  | 'trim-start'
  | 'trim-end'
  | 'reset-duration';

export type TrackContextAction =
  | 'rename'
  | 'change-color'
  | 'mute'
  | 'solo'
  | 'delete'
  | 'add-track-above'
  | 'add-track-below';
