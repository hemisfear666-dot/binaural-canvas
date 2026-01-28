
# Add Loop and Repeat Playback Controls

## Overview
Add loop playback controls to the transport section, positioned between the main play button and the status indicator. Users will be able to cycle through three modes:
- **Off** (default): Playback stops when the track ends
- **Repeat Once**: After the track finishes, it plays exactly one more time then stops
- **Loop**: Continuous looping until manually stopped

## Visual Design
A single toggle button that cycles through the three states with distinct icons:
- Off: No repeat icon (dimmed)
- Repeat Once: Repeat icon with "1" badge
- Loop: Repeat icon (highlighted/active)

The button will match the existing transport control styling (outline variant, consistent sizing).

## Technical Details

### 1. Add Loop Mode Type (`src/types/binaural.ts`)
```typescript
export type LoopMode = 'off' | 'repeat-once' | 'loop';
```

### 2. Update Audio Engine (`src/hooks/useAudioEngine.ts`)
- Add `loopMode` parameter to the hook
- Modify the `updateTime` callback to handle end-of-track behavior:
  - When `loopMode === 'off'`: Stop (current behavior)
  - When `loopMode === 'repeat-once'`: Restart playback once, then switch to 'off'
  - When `loopMode === 'loop'`: Restart playback from beginning continuously
- Add an `onLoopModeChange` callback for when repeat-once finishes

### 3. Update Transport Controls (`src/components/binaural/TransportControls.tsx`)
- Add new props: `loopMode` and `onLoopModeChange`
- Add a toggle button between the play button and status indicator
- Use `Repeat` and `Repeat1` icons from lucide-react
- Button cycles through: off → repeat-once → loop → off

### 4. Wire Up in BinauralWorkstation (`src/components/binaural/BinauralWorkstation.tsx`)
- Add `loopMode` state (not persisted to localStorage for now - playback preference)
- Pass `loopMode` to the audio engine
- Pass `loopMode` and handler to TransportControls

## Button Appearance States
| Mode | Icon | Color | Tooltip |
|------|------|-------|---------|
| Off | Repeat | Muted/dimmed | "Loop: Off" |
| Repeat Once | Repeat1 | Accent color | "Repeat Once" |
| Loop | Repeat | Primary color | "Loop" |

## File Changes Summary
1. **`src/types/binaural.ts`** - Add `LoopMode` type
2. **`src/hooks/useAudioEngine.ts`** - Handle loop/repeat logic at end of playback
3. **`src/components/binaural/TransportControls.tsx`** - Add loop toggle button UI
4. **`src/components/binaural/BinauralWorkstation.tsx`** - Add state and wire everything together
