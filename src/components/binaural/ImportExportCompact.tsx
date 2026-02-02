import { useRef, useCallback, useState } from 'react';
import { Track } from '@/types/binaural';
import { CustomPreset } from '@/hooks/useCustomPresets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Upload, Copy, Check, FileJson, Star } from 'lucide-react';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ImportExportCompactProps {
  track: Track;
  onImport: (track: Track) => void;
  onTitleChange: (title: string) => void;
  customPresets?: CustomPreset[];
  onImportPresets?: (presets: CustomPreset[]) => void;
}

export function ImportExportCompact({ 
  track, 
  onImport, 
  onTitleChange, 
  customPresets, 
  onImportPresets 
}: ImportExportCompactProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presetsInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const exportData = JSON.stringify({ ...track, customPresets: customPresets ?? [] }, null, 2);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(exportData);
    setCopied(true);
    toast.success('JSON copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }, [exportData]);

  const handleExportFile = useCallback(() => {
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${track.title.replace(/\s+/g, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Track exported');
  }, [exportData, track.title]);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.sections && Array.isArray(data.sections)) {
            if (data.customPresets && Array.isArray(data.customPresets) && onImportPresets) {
              onImportPresets(data.customPresets);
            }
            const { customPresets: _, ...trackData } = data;
            onImport(trackData);
            toast.success('Track imported');
          } else {
            toast.error('Invalid track format');
          }
        } catch {
          toast.error('Failed to parse file');
        }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [onImport, onImportPresets]
  );

  const handleExportPresetsOnly = useCallback(() => {
    if (!customPresets || customPresets.length === 0) {
      toast.error('No custom presets');
      return;
    }
    const blob = new Blob([JSON.stringify(customPresets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom-presets.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${customPresets.length} preset(s)`);
  }, [customPresets]);

  const handleImportPresetsOnly = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onImportPresets) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (Array.isArray(data)) {
            onImportPresets(data);
            toast.success(`Imported ${data.length} preset(s)`);
          } else {
            toast.error('Invalid format');
          }
        } catch {
          toast.error('Failed to parse');
        }
      };
      reader.readAsText(file);
      if (presetsInputRef.current) presetsInputRef.current.value = '';
    },
    [onImportPresets]
  );

  const presetCount = customPresets?.length ?? 0;

  return (
    <div className="panel rounded-lg p-3 space-y-3">
      {/* Header row: Title + JSON button */}
      <div className="flex items-center gap-2">
        <Input
          value={track.title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="h-7 flex-1 bg-void border-border text-sm font-medium"
          placeholder="Untitled Track"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary shrink-0"
              title="View JSON"
            >
              <FileJson className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2" align="end">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">JSON Data</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-6 text-xs"
              >
                {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <pre className="text-[10px] bg-void p-2 rounded max-h-48 overflow-auto font-mono">
              {exportData}
            </pre>
          </PopoverContent>
        </Popover>
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
      <input ref={presetsInputRef} type="file" accept=".json" onChange={handleImportPresetsOnly} className="hidden" />

      {/* Unified action grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Track actions */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="h-8 text-xs border-border hover:border-primary hover:bg-primary/5"
        >
          <Upload className="h-3 w-3 mr-1.5" />
          Import Project
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportFile}
          className="h-8 text-xs border-accent/50 text-accent hover:border-accent hover:bg-accent/5"
        >
          <Download className="h-3 w-3 mr-1.5" />
          Export Project
        </Button>

        {/* Preset actions */}
        {onImportPresets && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => presetsInputRef.current?.click()}
              className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Star className="h-3 w-3 mr-1.5 opacity-60" />
              Import Presets
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportPresetsOnly}
              disabled={presetCount === 0}
              className="h-7 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <Star className="h-3 w-3 mr-1.5 opacity-60" />
              Export Presets
              {presetCount > 0 && (
                <span className="ml-1.5 text-[10px] opacity-60">({presetCount})</span>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
