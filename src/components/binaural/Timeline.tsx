import { useRef, useCallback, useMemo } from 'react';
import { Section } from '@/types/binaural';

interface TimelineProps {
  sections: Section[];
  currentTime: number;
  currentSectionIndex: number | null;
  pixelsPerSecond?: number;
  onSeek: (time: number) => void;
  onSectionClick: (index: number) => void;
}

export function Timeline({
  sections,
  currentTime,
  currentSectionIndex,
  pixelsPerSecond = 10,
  onSeek,
  onSectionClick,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const totalDuration = useMemo(() => {
    return sections.reduce((acc, s) => acc + s.duration, 0);
  }, [sections]);

  const totalWidth = totalDuration * pixelsPerSecond;

  // Generate time markers
  const timeMarkers = useMemo(() => {
    const markers = [];
    const interval = totalDuration > 300 ? 60 : totalDuration > 60 ? 10 : 5;
    for (let t = 0; t <= totalDuration; t += interval) {
      markers.push(t);
    }
    return markers;
  }, [totalDuration]);

  // Handle click to seek
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + containerRef.current.scrollLeft;
      const time = Math.max(0, Math.min(x / pixelsPerSecond, totalDuration));
      onSeek(time);
    },
    [pixelsPerSecond, totalDuration, onSeek]
  );

  // Format time for markers
  const formatMarkerTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate section positions
  const sectionPositions = useMemo(() => {
    let offset = 0;
    return sections.map((section) => {
      const pos = { left: offset * pixelsPerSecond, width: section.duration * pixelsPerSecond };
      offset += section.duration;
      return pos;
    });
  }, [sections, pixelsPerSecond]);

  return (
    <div className="panel rounded-lg overflow-hidden">
      {/* Time ruler */}
      <div className="h-6 bg-void-surface border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 overflow-x-auto scrollbar-hide" style={{ width: '100%' }}>
          <div style={{ width: totalWidth, minWidth: '100%' }} className="h-full relative">
            {timeMarkers.map((t) => (
              <div
                key={t}
                className="absolute top-0 h-full flex flex-col justify-end"
                style={{ left: t * pixelsPerSecond }}
              >
                <div className="h-2 w-px bg-muted-foreground/30" />
                <span className="text-[10px] font-mono text-muted-foreground ml-1">
                  {formatMarkerTime(t)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline track */}
      <div
        ref={containerRef}
        className="h-24 relative overflow-x-auto cursor-crosshair"
        onClick={handleClick}
        style={{ background: 'linear-gradient(180deg, hsl(var(--void-surface)) 0%, hsl(var(--void)) 100%)' }}
      >
        <div style={{ width: totalWidth, minWidth: '100%' }} className="h-full relative">
          {/* Grid lines */}
          {timeMarkers.map((t) => (
            <div
              key={t}
              className="absolute top-0 bottom-0 w-px bg-border/30"
              style={{ left: t * pixelsPerSecond }}
            />
          ))}

          {/* Section blocks */}
          {sections.map((section, index) => {
            const pos = sectionPositions[index];
            const isActive = currentSectionIndex === index;
            const isMuted = section.muted;

            return (
              <div
                key={section.id}
                className={`absolute top-2 bottom-2 track-block cursor-pointer ${
                  isMuted ? 'muted' : ''
                } ${isActive ? 'active' : ''}`}
                style={{
                  left: pos.left,
                  width: pos.width - 2,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSectionClick(index);
                }}
              >
                {/* Waveform visualization */}
                <div className="absolute inset-0 flex items-center justify-center gap-0.5 px-2 overflow-hidden">
                  {Array.from({ length: Math.max(1, Math.floor(pos.width / 4)) }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-0.5 bg-primary/60 rounded-full ${
                        isActive && !isMuted ? 'animate-waveform' : ''
                      }`}
                      style={{
                        height: `${20 + Math.sin(i * 0.5) * 30 + Math.random() * 20}%`,
                        animationDelay: `${i * 0.05}s`,
                        opacity: isMuted ? 0.3 : 0.7,
                      }}
                    />
                  ))}
                </div>

                {/* Section label */}
                <div className="absolute bottom-1 left-2 right-2">
                  <span className="text-[10px] font-medium text-foreground/80 truncate block">
                    {section.name}
                  </span>
                </div>

                {/* Beat frequency badge */}
                <div className="absolute top-1 right-1">
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-primary/20 text-primary">
                    {section.beat}Hz
                  </span>
                </div>
              </div>
            );
          })}

          {/* Playhead */}
          <div
            className="playhead"
            style={{ left: currentTime * pixelsPerSecond }}
          >
            {/* Playhead handle */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full shadow-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
