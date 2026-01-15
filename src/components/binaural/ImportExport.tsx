import { useRef, useCallback, useState } from 'react';
import { Track } from '@/types/binaural';
import { CustomPreset } from '@/hooks/useCustomPresets';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Upload, Copy, Check, Star } from 'lucide-react';
import { toast } from 'sonner';

interface ImportExportProps {
  track: Track;
  onImport: (track: Track) => void;
  onTitleChange: (title: string) => void;
  customPresets?: CustomPreset[];
  onImportPresets?: (presets: CustomPreset[]) => void;
}

export function ImportExport({ track, onImport, onTitleChange, customPresets, onImportPresets }: ImportExportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presetsInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  // Include custom presets in export if available
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
    toast.success('Track exported successfully');
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
            // Import custom presets if present
            if (data.customPresets && Array.isArray(data.customPresets) && onImportPresets) {
              onImportPresets(data.customPresets);
              toast.success(`Imported ${data.customPresets.length} custom preset(s)`);
            }
            // Remove customPresets from track data before importing
            const { customPresets: _, ...trackData } = data;
            onImport(trackData);
            toast.success('Track imported successfully');
          } else {
            toast.error('Invalid track format');
          }
        } catch (err) {
          toast.error('Failed to parse JSON file');
        }
      };
      reader.readAsText(file);
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [onImport, onImportPresets]
  );

  const handleExportPresetsOnly = useCallback(() => {
    if (!customPresets || customPresets.length === 0) {
      toast.error('No custom presets to export');
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
            toast.error('Invalid presets format');
          }
        } catch {
          toast.error('Failed to parse presets file');
        }
      };
      reader.readAsText(file);

      if (presetsInputRef.current) {
        presetsInputRef.current.value = '';
      }
    },
    [onImportPresets]
  );

  const handlePasteImport = useCallback(
    (value: string) => {
      if (!value.trim()) return;
      try {
        const data = JSON.parse(value);
        if (data.sections && Array.isArray(data.sections)) {
          // Import custom presets if present
          if (data.customPresets && Array.isArray(data.customPresets) && onImportPresets) {
            onImportPresets(data.customPresets);
          }
          const { customPresets: _, ...trackData } = data;
          onImport(trackData);
          toast.success('Track imported from JSON');
        } else {
          toast.error('Invalid track format');
        }
      } catch {
        // Silent fail for paste - user might still be typing
      }
    },
    [onImport, onImportPresets]
  );

  return (
    <div className="panel rounded-lg p-4 space-y-4">
      {/* Track Title */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          Track Title
        </Label>
        <Input
          value={track.title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="bg-void border-border text-lg font-medium"
          placeholder="Untitled Track"
        />
      </div>

      {/* Import/Export Actions */}
      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
        />
        <input
          ref={presetsInputRef}
          type="file"
          accept=".json"
          onChange={handleImportPresetsOnly}
          className="hidden"
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-border hover:border-primary hover:bg-primary/5"
        >
          <Upload className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="truncate">Import Track</span>
        </Button>
        <Button
          variant="outline"
          onClick={handleExportFile}
          className="w-full border-accent/50 text-accent hover:border-accent hover:bg-accent/10"
        >
          <Download className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="truncate">Export Track</span>
        </Button>
      </div>

      {/* Custom Presets Import/Export */}
      {onImportPresets && (
        <div className="space-y-2 pt-2 border-t border-border">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Star className="h-3 w-3" />
            Custom Presets ({customPresets?.length ?? 0})
          </Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => presetsInputRef.current?.click()}
              className="flex-1 border-border hover:border-primary text-xs"
            >
              <Upload className="h-3 w-3 mr-1" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPresetsOnly}
              disabled={!customPresets || customPresets.length === 0}
              className="flex-1 border-primary/50 text-primary hover:border-primary text-xs disabled:opacity-50"
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          </div>
        </div>
      )}

      {/* JSON Preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            JSON Data
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 text-xs text-muted-foreground hover:text-primary"
          >
            {copied ? (
              <Check className="h-3 w-3 mr-1 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 mr-1" />
            )}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <Textarea
          value={exportData}
          onChange={(e) => handlePasteImport(e.target.value)}
          className="font-mono text-xs bg-void border-border h-40 resize-none"
          placeholder="Paste JSON here to import..."
        />
      </div>
    </div>
  );
}
