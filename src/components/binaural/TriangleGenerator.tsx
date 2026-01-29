import { useRef, useEffect, useCallback, useState } from 'react';
import { useElementSize } from '@/hooks/useElementSize';
interface TriangleGeneratorProps {
  carrier: number;
  pulse: number;
  onCarrierChange: (carrier: number) => void;
  onPulseChange: (pulse: number) => void;
  disabled?: boolean;
}
const UI = {
  width: 220,
  height: 190,
  puckRadius: 10,
  safetyBuffer: 4
};
const AUDIO_CONFIG = {
  minCarrier: 50,
  maxCarrier: 900,
  minPulse: 0.5,
  maxPulse: 40
};
export function TriangleGenerator({
  carrier,
  pulse,
  onCarrierChange,
  onPulseChange,
  disabled = false
}: TriangleGeneratorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const puckRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useElementSize(containerRef);
  const [isDragging, setIsDragging] = useState(false);
  const [currentPos, setCurrentPos] = useState({
    x: UI.width / 2,
    y: UI.height / 2
  });

  const scaleX = (size.width || UI.width) / UI.width;
  const scaleY = (size.height || UI.height) / UI.height;
  const scale = Math.max(0.01, Math.min(scaleX, scaleY));

  // Convert audio values to position
  const getPositionFromValues = useCallback((c: number, p: number) => {
    const yPercent = (p - AUDIO_CONFIG.minPulse) / (AUDIO_CONFIG.maxPulse - AUDIO_CONFIG.minPulse);
    const targetY = (1 - yPercent) * UI.height;
    const mid = (AUDIO_CONFIG.maxCarrier + AUDIO_CONFIG.minCarrier) / 2;
    const range = (AUDIO_CONFIG.maxCarrier - AUDIO_CONFIG.minCarrier) / 2;
    const relativeX = (c - mid) / range;
    const center = UI.width / 2;
    const percentHeight = Math.max(0.01, targetY / UI.height);
    const halfWidth = UI.width / 2 * percentHeight;
    const targetX = center + relativeX * halfWidth;
    return {
      x: targetX,
      y: targetY
    };
  }, []);

  // Convert position to audio values
  const getValuesFromPosition = useCallback((x: number, y: number) => {
    const yPercent = 1 - y / UI.height;
    const newPulse = yPercent * (AUDIO_CONFIG.maxPulse - AUDIO_CONFIG.minPulse) + AUDIO_CONFIG.minPulse;
    const percentHeight = Math.max(0.01, y / UI.height);
    const currentHalfWidth = UI.width / 2 * percentHeight;
    let relativeX = (x - UI.width / 2) / currentHalfWidth;
    if (y === 0) relativeX = 0;
    const midCarrier = (AUDIO_CONFIG.maxCarrier + AUDIO_CONFIG.minCarrier) / 2;
    const rangeVal = (AUDIO_CONFIG.maxCarrier - AUDIO_CONFIG.minCarrier) / 2;
    const newCarrier = midCarrier + relativeX * rangeVal;
    return {
      carrier: Math.round(newCarrier),
      pulse: parseFloat(newPulse.toFixed(1))
    };
  }, []);

  // Constrain to triangle
  const constrainToTriangle = useCallback((x: number, y: number) => {
    const maxY = UI.height - UI.puckRadius - UI.safetyBuffer;
    const minY = UI.puckRadius;
    const newY = Math.max(minY, Math.min(y, maxY));
    const percentHeight = newY / UI.height;
    const currentHalfWidth = UI.width / 2 * percentHeight;
    const safeHalfWidth = Math.max(0, currentHalfWidth - UI.puckRadius - UI.safetyBuffer);
    const minX = UI.width / 2 - safeHalfWidth;
    const maxX = UI.width / 2 + safeHalfWidth;
    const newX = Math.max(minX, Math.min(x, maxX));
    return {
      x: newX,
      y: newY
    };
  }, []);

  // Update puck position when carrier/pulse change externally
  useEffect(() => {
    if (!isDragging) {
      const pos = getPositionFromValues(carrier, pulse);
      const constrained = constrainToTriangle(pos.x, pos.y);
      setCurrentPos(constrained);
    }
  }, [carrier, pulse, isDragging, getPositionFromValues, constrainToTriangle]);

  // Handle puck movement
  const handlePuckMove = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current || disabled) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Convert from rendered pixels -> logical UI units so everything stays in sync while scaling
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const x = localX / (rect.width ? rect.width / UI.width : 1);
    const y = localY / (rect.height ? rect.height / UI.height : 1);
    const constrained = constrainToTriangle(x, y);
    setCurrentPos(constrained);
    const values = getValuesFromPosition(constrained.x, constrained.y);
    onCarrierChange(values.carrier);
    onPulseChange(values.pulse);
  }, [constrainToTriangle, getValuesFromPosition, onCarrierChange, onPulseChange, disabled]);

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
  }, [disabled]);
  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) handlePuckMove(e.clientX, e.clientY);
    };
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDragging, handlePuckMove]);

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
  }, [disabled]);
  useEffect(() => {
    const handleTouchEnd = () => setIsDragging(false);
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) {
        e.preventDefault();
        handlePuckMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchmove', handleTouchMove, {
      passive: false
    });
    return () => {
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isDragging, handlePuckMove]);

  // Puck style calculations
  const percentHeight = Math.max(0.01, currentPos.y / UI.height);
  const currentHalfWidth = UI.width / 2 * percentHeight;
  let relativeX = (currentPos.x - UI.width / 2) / currentHalfWidth;
  if (currentPos.y === 0) relativeX = 0;
  const intensity = Math.abs(relativeX);
  const color = relativeX < 0 ? 'hsl(var(--primary))' : 'hsl(var(--accent))';
  const puckRadiusPx = UI.puckRadius * scale;
  const puckSizePx = UI.puckRadius * 2 * scale;
  const puckLeftPx = currentPos.x * scaleX - puckRadiusPx;
  const puckTopPx = currentPos.y * scaleY - puckRadiusPx;
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

  // Calculate grid line positions for crosshair
  const gridLinesX = [0.25, 0.5, 0.75]; // 25%, 50%, 75% carrier
  const gridLinesY = [0.25, 0.5, 0.75]; // pulse positions

  return (
    <div className="panel rounded-lg p-4 mb-4 overflow-hidden min-w-0">
      <h3 className="text-xs uppercase tracking-widest font-medium mb-3 text-muted-foreground">
        Frequency Generator
      </h3>
      
      {disabled ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Select a sequence to use the generator
        </div>
      ) : (
        <>
          {/* Readouts with axis labels */}
          <div className="flex justify-between mb-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-primary/60">X-Axis</span>
              <span className="text-muted-foreground">Carrier: </span>
              <span className="font-mono text-primary font-medium">{carrier} Hz</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-accent/60">Y-Axis</span>
              <span className="text-muted-foreground">Pulse: </span>
              <span className="font-mono text-accent font-medium">{pulse.toFixed(1)} Hz</span>
            </div>
          </div>

          {/* Triangle Area */}
          <div
            ref={containerRef}
            className="relative mx-auto select-none overflow-hidden rounded-lg"
            style={{
              width: '100%',
              maxWidth: UI.width,
              aspectRatio: `${UI.width} / ${UI.height}`,
              background: 'hsl(var(--void))',
            }}
          >
            {/* Triangle Background with gradient */}
            <div 
              className="absolute inset-0" 
              style={{
                clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                background: `
                  radial-gradient(ellipse at 50% 80%, hsl(var(--accent) / 0.15) 0%, transparent 60%),
                  radial-gradient(ellipse at 50% 20%, hsl(var(--primary) / 0.2) 0%, transparent 50%),
                  linear-gradient(180deg, hsl(var(--primary) / 0.1) 0%, hsl(var(--accent) / 0.15) 100%)
                `
              }} 
            />
            
            {/* Triangle Border - glowing */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none" 
              viewBox={`0 0 ${UI.width} ${UI.height}`}
            >
              <defs>
                <linearGradient id="triangleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <polygon 
                points={`${UI.width / 2},0 0,${UI.height} ${UI.width},${UI.height}`} 
                fill="none" 
                stroke="url(#triangleGradient)" 
                strokeWidth="2" 
                filter="url(#glow)"
                opacity="0.7" 
              />
            </svg>

            {/* Crosshair Grid - vertical lines (Carrier axis) */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${UI.width} ${UI.height}`}
              style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
            >
              {/* Center vertical line - prominent */}
              <line 
                x1={UI.width / 2} y1={0} 
                x2={UI.width / 2} y2={UI.height} 
                stroke="hsl(var(--primary))" 
                strokeWidth="1" 
                opacity="0.4"
              />
              
              {/* Vertical grid lines */}
              {gridLinesX.filter(p => p !== 0.5).map((percent) => (
                <line
                  key={`v-${percent}`}
                  x1={UI.width * percent}
                  y1={0}
                  x2={UI.width * percent}
                  y2={UI.height}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="0.5"
                  opacity="0.25"
                  strokeDasharray="4 4"
                />
              ))}
              
              {/* Horizontal grid lines (Pulse axis) */}
              {gridLinesY.map((percent) => (
                <line
                  key={`h-${percent}`}
                  x1={0}
                  y1={UI.height * percent}
                  x2={UI.width}
                  y2={UI.height * percent}
                  stroke={percent === 0.5 ? "hsl(var(--accent))" : "hsl(var(--muted-foreground))"}
                  strokeWidth={percent === 0.5 ? "1" : "0.5"}
                  opacity={percent === 0.5 ? "0.4" : "0.25"}
                  strokeDasharray={percent === 0.5 ? "none" : "4 4"}
                />
              ))}
            </svg>

            {/* Axis Labels */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Carrier axis label */}
              <div 
                className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full pt-1"
                style={{ fontSize: '8px' }}
              >
                <span className="text-primary/50 uppercase tracking-widest">← Low Hz · Carrier · High Hz →</span>
              </div>
              
              {/* Pulse axis label */}
              <div 
                className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 pr-1"
                style={{ 
                  fontSize: '8px',
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg) translateX(100%) translateY(-50%)',
                }}
              >
                <span className="text-accent/50 uppercase tracking-widest">← Slow · Pulse · Fast →</span>
              </div>
            </div>

            {/* Corner labels */}
            <div className="absolute inset-0 pointer-events-none text-[9px] font-medium uppercase tracking-wider">
              <span className="absolute top-2 left-1/2 -translate-x-1/2 text-primary/80 bg-void/50 px-1.5 py-0.5 rounded">
                Focus
              </span>
              <span className="absolute bottom-2 left-3 text-muted-foreground/80 bg-void/50 px-1.5 py-0.5 rounded">
                Ground
              </span>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-accent/80 bg-void/50 px-1.5 py-0.5 rounded">
                Deep
              </span>
              <span className="absolute bottom-2 right-3 text-muted-foreground/80 bg-void/50 px-1.5 py-0.5 rounded">
                Mind
              </span>
            </div>

            {/* Crosshair cursor lines following puck */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${UI.width} ${UI.height}`}
            >
              {/* Vertical line through puck */}
              <line
                x1={currentPos.x}
                y1={0}
                x2={currentPos.x}
                y2={UI.height}
                stroke="hsl(var(--primary))"
                strokeWidth="1"
                opacity="0.3"
                strokeDasharray="2 3"
              />
              {/* Horizontal line through puck */}
              <line
                x1={0}
                y1={currentPos.y}
                x2={UI.width}
                y2={currentPos.y}
                stroke="hsl(var(--accent))"
                strokeWidth="1"
                opacity="0.3"
                strokeDasharray="2 3"
              />
            </svg>

            {/* Canvas for wave effect */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
              width={Math.max(1, Math.round((size.width || UI.width) * dpr))}
              height={Math.max(1, Math.round((size.height || UI.height) * dpr))}
            />

            {/* Puck */}
            <div 
              ref={puckRef} 
              onMouseDown={handleMouseDown} 
              onTouchStart={handleTouchStart} 
              className={`absolute rounded-full cursor-grab transition-all duration-75 ${isDragging ? 'cursor-grabbing scale-110' : 'hover:scale-105'}`} 
              style={{
                width: puckSizePx,
                height: puckSizePx,
                left: puckLeftPx,
                top: puckTopPx,
                background: `radial-gradient(circle at 30% 30%, hsl(var(--foreground)), hsl(var(--muted)))`,
                boxShadow: `
                  0 0 10px white,
                  0 0 ${15 + intensity * 25}px ${color},
                  inset 0 0 4px rgba(255,255,255,0.3)
                `,
                border: '1px solid rgba(255,255,255,0.2)',
                zIndex: 10
              }} 
            />
          </div>
          
          {/* Scale indicators below */}
          <div className="flex justify-between mt-2 text-[9px] text-muted-foreground/60 font-mono">
            <span>{AUDIO_CONFIG.minCarrier}Hz</span>
            <span className="text-primary/60">{Math.round((AUDIO_CONFIG.maxCarrier + AUDIO_CONFIG.minCarrier) / 2)}Hz</span>
            <span>{AUDIO_CONFIG.maxCarrier}Hz</span>
          </div>
        </>
      )}
    </div>
  );
}