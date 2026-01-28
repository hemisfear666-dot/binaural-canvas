
# Add Loop and Repeat Playback Controls

## Status: ✅ COMPLETED

## Overview
Added loop playback controls to the transport section, positioned between the main play button and the status indicator. Users can cycle through three modes:
- **Off** (default): Playback stops when the track ends
- **Repeat Once**: After the track finishes, it plays exactly one more time then stops
- **Loop**: Continuous looping until manually stopped

## Visual Design
A single toggle button that cycles through the three states with distinct icons:
- Off: Repeat icon (dimmed/muted)
- Repeat Once: Repeat1 icon with accent color
- Loop: Repeat icon with primary color

## Implementation Summary

### 1. Added LoopMode Type (`src/types/binaural.ts`)
```typescript
export type LoopMode = 'off' | 'repeat-once' | 'loop';
```

### 2. Updated Audio Engine (`src/hooks/useAudioEngine.ts`)
- Added `loopMode` and `onLoopModeChange` parameters
- Implemented loop/repeat logic at end of playback using refs to avoid stale closures
- Added `scheduleAllSections` helper for restarting playback

### 3. Updated Transport Controls (`src/components/binaural/TransportControls.tsx`)
- Added loop toggle button with tooltip
- Visual feedback for each mode state
- Cycles through: off → repeat-once → loop → off

### 4. Wired Up in BinauralWorkstation (`src/components/binaural/BinauralWorkstation.tsx`)
- Added `loopMode` state
- Connected to audio engine and transport controls

### 5. Keyboard Shortcut (`src/components/binaural/KeyboardShortcuts.tsx`)
- Added `L` key to cycle through loop modes
