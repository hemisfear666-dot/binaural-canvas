import { useRef, useEffect, useCallback, useState } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);
  const [currentPos, setCurrentPos] = useState({
    x: UI.width / 2,
    y: UI.height / 2
  });

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
    const x = clientX - rect.left;
    const y = clientY - rect.top;
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
  return <div className="panel rounded-lg p-4 mb-4 overflow-hidden">
      <h3 className="text-xs uppercase tracking-widest font-medium mb-3 text-slate-400">
        Frequency Generator
      </h3>
      
      {disabled ? <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Select a sequence to use the generator
        </div> : <>
          {/* Readouts */}
          <div className="flex justify-between mb-3 text-xs">
            <div>
              <span className="text-muted-foreground">Carrier: </span>
              <span className="font-mono text-primary">{carrier} Hz</span>
            </div>
            <div>
              <span className="text-muted-foreground">Pulse: </span>
              <span className="font-mono text-accent">{pulse.toFixed(1)} Hz</span>
            </div>
          </div>

          {/* Triangle Area */}
          <div ref={containerRef} className="relative mx-auto select-none max-w-full" style={{
        width: UI.width,
        height: UI.height,
        maxWidth: '100%'
      }}>
            {/* Triangle Background */}
            <div className="absolute inset-0" style={{
          clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
          background: 'linear-gradient(180deg, hsl(var(--primary)/0.2) 0%, hsl(var(--accent)/0.2) 100%)'
        }} />
            
            {/* Triangle Border */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${UI.width} ${UI.height}`}>
              <polygon points={`${UI.width / 2},0 0,${UI.height} ${UI.width},${UI.height}`} fill="none" stroke="hsl(var(--accent))" strokeWidth="2" opacity="0.5" />
            </svg>

            {/* Grid lines */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/30" />
              <div className="absolute left-0 right-0 top-1/2 h-px bg-border/30" />
            </div>

            {/* Labels */}
            <div className="absolute inset-0 pointer-events-none text-[10px] text-muted-foreground uppercase tracking-wider">
              <span className="absolute top-1 left-1/2 -translate-x-1/2">Focus</span>
              <span className="absolute bottom-1 left-2">Ground</span>
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2">Deep</span>
              <span className="absolute bottom-1 right-2">Mind</span>
            </div>

            {/* Canvas for wave effect */}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-30" width={UI.width} height={UI.height} />

            {/* Puck */}
            <div ref={puckRef} onMouseDown={handleMouseDown} onTouchStart={handleTouchStart} className={`absolute rounded-full cursor-grab transition-shadow ${isDragging ? 'cursor-grabbing' : ''}`} style={{
          width: UI.puckRadius * 2,
          height: UI.puckRadius * 2,
          left: currentPos.x - UI.puckRadius,
          top: currentPos.y - UI.puckRadius,
          background: 'radial-gradient(circle at 30% 30%, hsl(var(--foreground)), hsl(var(--muted)))',
          boxShadow: `0 0 15px white, 0 0 ${20 + intensity * 30}px ${color}`,
          zIndex: 10
        }} />
          </div>
        </>}
    </div>;
}