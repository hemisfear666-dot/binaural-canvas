// Playback scheduling types - derived from timeline clips

import { Section } from './binaural';
import { TimelineClip, TimelineTrack } from './daw';

/**
 * A scheduled audio event derived from a timeline clip.
 * Contains all info needed to play a section at a specific time.
 */
export interface ScheduledEvent {
  clipId: string;
  sectionId: string;
  trackId: string;
  startTime: number;
  duration: number;
  muted: boolean;
  // Resolved section data
  section: Section;
}

/**
 * Generate a playback schedule from timeline clips and section library.
 * Only includes clips whose sections exist and are not muted at track/clip level.
 */
export function generatePlaybackSchedule(
  clips: TimelineClip[],
  tracks: TimelineTrack[],
  sections: Section[]
): ScheduledEvent[] {
  const sectionMap = new Map(sections.map(s => [s.id, s]));
  const trackMap = new Map(tracks.map(t => [t.id, t]));
  
  // Get solo'd tracks (if any are solo'd, only those play)
  const soloTracks = tracks.filter(t => t.solo);
  const hasSolo = soloTracks.length > 0;
  
  const events: ScheduledEvent[] = [];
  
  for (const clip of clips) {
    const section = sectionMap.get(clip.sectionId);
    const track = trackMap.get(clip.trackId);
    
    if (!section || !track) continue;
    
    // Skip if track is muted (unless it's solo'd)
    if (hasSolo && !track.solo) continue;
    if (!hasSolo && track.muted) continue;
    
    // Skip if clip is muted
    if (clip.muted) continue;
    
    events.push({
      clipId: clip.id,
      sectionId: clip.sectionId,
      trackId: clip.trackId,
      startTime: clip.startTime,
      duration: clip.duration,
      muted: false,
      section,
    });
  }
  
  // Sort by start time
  return events.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Get total duration of the playback schedule (end of last event)
 */
export function getScheduleDuration(events: ScheduledEvent[]): number {
  if (events.length === 0) return 0;
  return Math.max(...events.map(e => e.startTime + e.duration));
}

/**
 * Find which events are active at a given time
 */
export function getActiveEventsAtTime(
  events: ScheduledEvent[],
  time: number
): ScheduledEvent[] {
  return events.filter(e => 
    time >= e.startTime && time < e.startTime + e.duration
  );
}
