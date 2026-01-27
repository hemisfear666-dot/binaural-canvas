import { AmbientMusicType } from '@/types/binaural';

/**
 * AMBIENT MUSIC TRACKS CONFIGURATION
 * ===================================
 * 
 * Edit this file to add your audio tracks.
 * 
 * Each track type needs a URL pointing to an audio file (MP3, WAV, OGG, etc.)
 * The audio will loop automatically.
 * 
 * Example URLs:
 * - Local: '/audio/soothing.mp3' (place file in public/audio/)
 * - CDN: 'https://cdn.example.com/audio/soothing.mp3'
 * - S3: 'https://your-bucket.s3.amazonaws.com/soothing.mp3'
 * 
 * IMPORTANT: Audio will NOT play until you add valid URLs below!
 */

export interface AmbientTrackConfig {
  url: string;      // Direct URL to audio file
  volume?: number;  // Optional volume multiplier (0-1, default: 1)
}

export const AMBIENT_MUSIC_TRACKS: Record<AmbientMusicType, AmbientTrackConfig | null> = {
  // ═══════════════════════════════════════════════════════════════════
  // SOOTHING - Warm, relaxing ambient music
  // ═══════════════════════════════════════════════════════════════════
  soothing: null, // Replace with: { url: '/audio/soothing.mp3' }

  // ═══════════════════════════════════════════════════════════════════
  // FOCUS - Minimal, concentration-enhancing ambient
  // ═══════════════════════════════════════════════════════════════════
  focus: null, // Replace with: { url: '/audio/focus.mp3' }

  // ═══════════════════════════════════════════════════════════════════
  // SLEEP - Deep, dark drone for rest
  // ═══════════════════════════════════════════════════════════════════
  sleep: null, // Replace with: { url: '/audio/sleep.mp3' }
};

/**
 * Helper to check if a track is configured
 */
export function isTrackConfigured(type: AmbientMusicType): boolean {
  const config = AMBIENT_MUSIC_TRACKS[type];
  return config !== null && typeof config.url === 'string' && config.url.length > 0;
}

/**
 * Get track config (returns null if not configured)
 */
export function getTrackConfig(type: AmbientMusicType): AmbientTrackConfig | null {
  return AMBIENT_MUSIC_TRACKS[type];
}
