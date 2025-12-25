import { useState, useCallback } from 'react';
import { Section } from '@/types/binaural';
import { SectionRow } from './SectionRow';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface SectionListProps {
  sections: Section[];
  currentSectionIndex: number | null;
  selectedIndices: Set<number>;
  activeEditIndex: number | null;
  onSectionsChange: (sections: Section[]) => void;
  onTestSection: (index: number) => void;
  onToggleSelect: (index: number) => void;
  onEditClick: (index: number) => void;
}

export function SectionList({
  sections,
  currentSectionIndex,
  selectedIndices,
  activeEditIndex,
  onSectionsChange,
  onTestSection,
  onToggleSelect,
  onEditClick,
}: SectionListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleUpdate = useCallback(
    (index: number, field: keyof Section, value: string | number | boolean) => {
      const updated = [...sections];
      updated[index] = { ...updated[index], [field]: value };
      onSectionsChange(updated);
    },
    [sections, onSectionsChange]
  );

  const handleDelete = useCallback(
    (index: number) => {
      const updated = sections.filter((_, i) => i !== index);
      onSectionsChange(updated);
    },
    [sections, onSectionsChange]
  );

  const handleAdd = useCallback(() => {
    const newSection: Section = {
      id: `section_${Date.now()}`,
      name: 'New Section',
      duration: 30,
      carrier: 200,
      beat: 10,
      volume: 0.8,
      muted: false,
    };
    onSectionsChange([...sections, newSection]);
  }, [sections, onSectionsChange]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...sections];
    const [removed] = updated.splice(dragIndex, 1);
    updated.splice(targetIndex, 0, removed);
    onSectionsChange(updated);

    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="grid grid-cols-[24px_40px_2fr_90px_90px_90px_120px_auto] gap-4 px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground font-medium">
        <div />
        <div className="text-center">#</div>
        <div>Name</div>

        {/* Align headers to the editable controls (input width + unit label) */}
        <div className="flex items-center justify-center gap-1">
          <span className="w-16 text-center">Carrier</span>
          <span className="w-5" aria-hidden="true" />
        </div>
        <div className="flex items-center justify-center gap-1">
          <span className="w-16 text-center">Pulse</span>
          <span className="w-5" aria-hidden="true" />
        </div>
        <div className="flex items-center justify-center gap-1">
          <span className="w-16 text-center">Duration</span>
          <span className="w-7" aria-hidden="true" />
        </div>

        {/* Match row layout: mute button + slider */}
        <div className="flex items-center gap-2">
          <span className="w-7" aria-hidden="true" />
          <span className="w-20 text-center">Volume</span>
        </div>

        <div className="text-right">Actions</div>
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {sections.map((section, index) => (
          <SectionRow
            key={section.id}
            section={section}
            index={index}
            isActive={currentSectionIndex === index}
            isSelected={selectedIndices.has(index)}
            isEditing={activeEditIndex === index}
            isDragging={dragIndex === index}
            isDragOver={dragOverIndex === index}
            onUpdate={(field, value) => handleUpdate(index, field, value)}
            onDelete={() => handleDelete(index)}
            onTest={() => onTestSection(index)}
            onToggleSelect={() => onToggleSelect(index)}
            onEditClick={() => onEditClick(index)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      {/* Add Button */}
      <Button
        variant="outline"
        onClick={handleAdd}
        className="w-full border-dashed border-accent/50 hover:border-accent hover:bg-accent/5 text-accent/70 hover:text-accent"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Section
      </Button>
    </div>
  );
}
