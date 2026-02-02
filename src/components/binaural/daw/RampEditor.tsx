import { useState, useRef, useCallback, useEffect } from 'react';
import { useElementSize } from '@/hooks/useElementSize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { X, TrendingUp } from 'lucide-react';
import { TimelineClip } from '@/types/daw';
import { Section } from '@/types/binaural';

interface RampEditorProps {
  clip: TimelineClip;
  section: Section;
  onSave: (updates: Partial<TimelineClip>) => void;
  onClose: () => void;
}

const UI = {
  width: 200,
  height: 170,
  puckRadius: 8,
  safetyBuffer: 4
};

const AUDIO_CONFIG = {
  minCarrier: 50,
  maxCarrier: 900,
  minPulse: 0.5,
  maxPulse: 40
};

export function RampEditor({ clip, section, onSave, onClose }: RampEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const puckRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(containerRef);
  
  const [isDragging, setIsDragging] = useState(false);
  const [rampEnabled, setRampEnabled] = useState(clip.rampEnabled ?? false);
  const [endCarrier, setEndCarrier] = useState(clip.endCarrier ?? section.carrier);
  const [endBeat, setEndBeat] = useState(clip.endBeat ?? section.beat);
  
  const [currentPos, setCurrentPos] = useState({ x: UI.width / 2, y: UI.height / 2 });

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
    return { x: targetX, y: targetY };
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
    return { x: newX, y: newY };
  }, []);

  // Update puck position when values change
  useEffect(() => {
    if (!isDragging) {
      const pos = getPositionFromValues(endCarrier, endBeat);
      const constrained = constrainToTriangle(pos.x, pos.y);
      setCurrentPos(constrained);
    }
  }, [endCarrier, endBeat, isDragging, getPositionFromValues, constrainToTriangle]);

  // Handle puck movement
  const handlePuckMove = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const x = localX / (rect.width ? rect.width / UI.width : 1);
    const y = localY / (rect.height ? rect.height / UI.height : 1);
    const constrained = constrainToTriangle(x, y);
    setCurrentPos(constrained);
    const values = getValuesFromPosition(constrained.x, constrained.y);
    setEndCarrier(values.carrier);
    setEndBeat(values.pulse);
    if (!rampEnabled) setRampEnabled(true);
  }, [constrainToTriangle, getValuesFromPosition, rampEnabled]);

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

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
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    const handleTouchEnd = () => setIsDragging(false);
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) {
        e.preventDefault();
        handlePuckMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isDragging, handlePuckMove]);

  // Calculate puck style
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

  const handleSave = () => {
    onSave({
      rampEnabled,
      endCarrier: rampEnabled ? endCarrier : undefined,
      endBeat: rampEnabled ? endBeat : undefined,
    });
    onClose();
  };

  const handleInputChange = (field: 'carrier' | 'beat', value: string) => {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      if (field === 'carrier') {
        const clamped = Math.max(AUDIO_CONFIG.minCarrier, Math.min(AUDIO_CONFIG.maxCarrier, parsed));
        setEndCarrier(clamped);
        if (!rampEnabled) setRampEnabled(true);
      } else {
        const clamped = Math.max(AUDIO_CONFIG.minPulse, Math.min(AUDIO_CONFIG.maxPulse, parsed));
        setEndBeat(clamped);
        if (!rampEnabled) setRampEnabled(true);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-void/95 border border-accent/20 rounded-xl shadow-2xl shadow-accent/10 w-[340px] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-void-surface">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium">Ramp To</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Enable Ramp</Label>
            <Switch checked={rampEnabled} onCheckedChange={setRampEnabled} />
          </div>

          {/* From → To display */}
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground bg-void-surface rounded-lg px-3 py-2">
            <div className="flex flex-col">
              <span className="uppercase tracking-wider text-[9px] text-primary/60">From</span>
              <span>{section.carrier}Hz / {section.beat}Hz</span>
            </div>
            <TrendingUp className="h-4 w-4 text-accent/50" />
            <div className="flex flex-col text-right">
              <span className="uppercase tracking-wider text-[9px] text-accent/60">To</span>
              <span className={rampEnabled ? 'text-accent' : ''}>{endCarrier}Hz / {endBeat}Hz</span>
            </div>
          </div>

          {/* Visual X-Y Generator */}
          <div
            ref={containerRef}
            className={`relative mx-auto select-none overflow-hidden rounded-lg transition-opacity ${rampEnabled ? '' : 'opacity-40 pointer-events-none'}`}
            style={{
              width: '100%',
              maxWidth: UI.width,
              aspectRatio: `${UI.width} / ${UI.height}`,
              background: 'hsl(var(--void))',
            }}
          >
            {/* Triangle Background */}
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
            
            {/* Triangle Border */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none" 
              viewBox={`0 0 ${UI.width} ${UI.height}`}
            >
              <defs>
                <linearGradient id="rampTriangleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" />
                </linearGradient>
              </defs>
              <polygon 
                points={`${UI.width / 2},0 0,${UI.height} ${UI.width},${UI.height}`} 
                fill="none" 
                stroke="url(#rampTriangleGradient)" 
                strokeWidth="1.5" 
                opacity="0.5" 
              />
            </svg>

            {/* Grid lines */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${UI.width} ${UI.height}`}
              style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
            >
              <line x1={UI.width / 2} y1={0} x2={UI.width / 2} y2={UI.height} stroke="hsl(var(--primary))" strokeWidth="0.5" opacity="0.3" />
              <line x1={0} y1={UI.height / 2} x2={UI.width} y2={UI.height / 2} stroke="hsl(var(--accent))" strokeWidth="0.5" opacity="0.3" />
            </svg>

            {/* Crosshair following puck */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${UI.width} ${UI.height}`}>
              <line x1={currentPos.x} y1={0} x2={currentPos.x} y2={UI.height} stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.4" strokeDasharray="2 3" />
              <line x1={0} y1={currentPos.y} x2={UI.width} y2={currentPos.y} stroke="hsl(var(--accent))" strokeWidth="1" opacity="0.4" strokeDasharray="2 3" />
            </svg>

            {/* Starting position indicator */}
            {(() => {
              const startPos = getPositionFromValues(section.carrier, section.beat);
              const constrained = constrainToTriangle(startPos.x, startPos.y);
              return (
                <div
                  className="absolute w-3 h-3 rounded-full border-2 border-muted-foreground/50 bg-void/50"
                  style={{
                    left: constrained.x * scaleX - 6,
                    top: constrained.y * scaleY - 6,
                  }}
                />
              );
            })()}

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
                  0 0 8px white,
                  0 0 ${12 + intensity * 20}px ${color},
                  inset 0 0 4px rgba(255,255,255,0.3)
                `,
                border: '1px solid rgba(255,255,255,0.2)',
                zIndex: 10
              }} 
            />
          </div>

          {/* Fine-tune inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-primary/60">End Carrier (Hz)</Label>
              <Input
                type="number"
                value={endCarrier}
                onChange={(e) => handleInputChange('carrier', e.target.value)}
                disabled={!rampEnabled}
                min={AUDIO_CONFIG.minCarrier}
                max={AUDIO_CONFIG.maxCarrier}
                className="h-8 text-xs font-mono bg-void border-border"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-accent/60">End Beat (Hz)</Label>
              <Input
                type="number"
                value={endBeat}
                step="0.1"
                onChange={(e) => handleInputChange('beat', e.target.value)}
                disabled={!rampEnabled}
                min={AUDIO_CONFIG.minPulse}
                max={AUDIO_CONFIG.maxPulse}
                className="h-8 text-xs font-mono bg-void border-border"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-void-surface">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            Apply Ramp
          </Button>
        </div>
      </div>
    </div>
  );
}