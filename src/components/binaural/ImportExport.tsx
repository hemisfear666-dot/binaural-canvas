import { useRef, useCallback } from 'react';
import { Track } from '@/types/binaural';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Upload, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

interface ImportExportProps {
  track: Track;
  onImport: (track: Track) => void;
  onTitleChange: (title: string) => void;
}

export function ImportExport({ track, onImport, onTitleChange }: ImportExportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const exportData = JSON.stringify(track, null, 2);

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
            onImport(data);
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
    [onImport]
  );

  const handlePasteImport = useCallback(
    (value: string) => {
      if (!value.trim()) return;
      try {
        const data = JSON.parse(value);
        if (data.sections && Array.isArray(data.sections)) {
          onImport(data);
          toast.success('Track imported from JSON');
        } else {
          toast.error('Invalid track format');
        }
      } catch {
        // Silent fail for paste - user might still be typing
      }
    },
    [onImport]
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
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 border-border hover:border-primary hover:bg-primary/5"
        >
          <Upload className="h-4 w-4 mr-2" />
          Import JSON
        </Button>
        <Button
          variant="outline"
          onClick={handleExportFile}
          className="flex-1 border-border hover:border-primary hover:bg-primary/5"
        >
          <Download className="h-4 w-4 mr-2" />
          Export JSON
        </Button>
      </div>

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
