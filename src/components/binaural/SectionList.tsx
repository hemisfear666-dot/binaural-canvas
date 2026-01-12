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
  testingIndex: number | null;
  onSectionsChange: (sections: Section[]) => void;
  onTestSection: (index: number) => void;
  onStopTest: () => void;
  onToggleSelect: (index: number) => void;
  onEditClick: (index: number) => void;
  onSaveAsPreset?: (section: Section) => void;
}

export function SectionList({
  sections,
  currentSectionIndex,
  selectedIndices,
  activeEditIndex,
  testingIndex,
  onSectionsChange,
  onTestSection,
  onStopTest,
  onToggleSelect,
  onEditClick,
  onSaveAsPreset,
}: SectionListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleUpdate = useCallback(
    (index: number, field: keyof Section, value: string | number | boolean | undefined) => {
      const updated = [...sections];
      if (value === undefined) {
        // Remove the optional field
        const { [field]: _, ...rest } = updated[index];
        updated[index] = rest as Section;
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
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

    // If we remove an item above the target, the target index shifts down by 1.
    const insertIndex = dragIndex < targetIndex ? targetIndex - 1 : targetIndex;
    updated.splice(insertIndex, 0, removed);

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
      {/* Header - Desktop only */}
      <div className="hidden md:grid grid-cols-[24px_40px_2fr_90px_90px_90px_120px_auto] gap-4 items-center p-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">
        <div />
        <div className="text-center">#</div>
        <div>Name</div>

        {/* Using arbitrary values -[4.5rem] to simulate ml-18, and -ml-12 for Volume */}
        <div className="text-left -ml-[5.2rem]">Carrier</div>
        <div className="text-left -ml-[5.2rem]">Pulse</div>
        <div className="text-left -ml-[5.2rem]">Duration</div>
        <div className="text-left -ml-[3.2rem]">Volume</div>

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
            isTesting={testingIndex === index}
            isDragging={dragIndex === index}
            isDragOver={dragOverIndex === index}
            onUpdate={(field, value) => handleUpdate(index, field, value)}
            onDelete={() => handleDelete(index)}
            onTest={() => onTestSection(index)}
            onStopTest={onStopTest}
            onToggleSelect={() => onToggleSelect(index)}
            onEditClick={() => onEditClick(index)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            onSaveAsPreset={onSaveAsPreset ? () => onSaveAsPreset(section) : undefined}
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
