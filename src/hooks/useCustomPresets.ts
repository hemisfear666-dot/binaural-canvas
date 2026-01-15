import { useState, useCallback, useEffect } from 'react';
import { Section } from '@/types/binaural';

export interface CustomPreset {
  id: string;
  name: string;
  description?: string;
  beat: number;
  endBeat?: number;
  carrier: number;
  endCarrier?: number;
  rampEnabled?: boolean;
  duration: number;
  createdAt: number;
}

const STORAGE_KEY = 'binaural-custom-presets';

// Use IndexedDB for large preset storage, with localStorage fallback
const openDB = (): Promise<IDBDatabase | null> => {
  return new Promise((resolve) => {
    if (!window.indexedDB) {
      resolve(null);
      return;
    }
    
    const request = indexedDB.open('BinauralPresetsDB', 1);
    
    request.onerror = () => resolve(null);
    
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('presets')) {
        db.createObjectStore('presets', { keyPath: 'id' });
      }
    };
  });
};

export function useCustomPresets() {
  const [presets, setPresets] = useState<CustomPreset[]>([]);
  const [loading, setLoading] = useState(true);

  // Load presets on mount
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const db = await openDB();
        
        if (db) {
          // Try IndexedDB first
          const transaction = db.transaction('presets', 'readonly');
          const store = transaction.objectStore('presets');
          const request = store.getAll();
          
          request.onsuccess = () => {
            const dbPresets = request.result as CustomPreset[];
            setPresets(dbPresets.sort((a, b) => b.createdAt - a.createdAt));
            setLoading(false);
          };
          
          request.onerror = () => {
            // Fallback to localStorage
            loadFromLocalStorage();
          };
        } else {
          loadFromLocalStorage();
        }
      } catch {
        loadFromLocalStorage();
      }
    };

    const loadFromLocalStorage = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as CustomPreset[];
          setPresets(parsed.sort((a, b) => b.createdAt - a.createdAt));
        }
      } catch (e) {
        console.warn('Failed to load custom presets:', e);
      }
      setLoading(false);
    };

    loadPresets();
  }, []);

  // Save presets whenever they change
  const savePresets = useCallback(async (newPresets: CustomPreset[]) => {
    try {
      const db = await openDB();
      
      if (db) {
        // Clear and re-add all (simpler for sync)
        const transaction = db.transaction('presets', 'readwrite');
        const store = transaction.objectStore('presets');
        store.clear();
        
        for (const preset of newPresets) {
          store.add(preset);
        }
      }
      
      // Always save to localStorage as backup (truncate if too large)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPresets.slice(0, 500)));
      } catch {
        // localStorage might be full, keep only 100
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPresets.slice(0, 100)));
      }
    } catch (e) {
      console.warn('Failed to save custom presets:', e);
    }
  }, []);

  const addPreset = useCallback((section: Section, customName?: string) => {
    const newPreset: CustomPreset = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: customName || section.name,
      beat: section.beat,
      endBeat: section.endBeat,
      carrier: section.carrier,
      endCarrier: section.endCarrier,
      rampEnabled: section.rampEnabled,
      duration: section.duration,
      createdAt: Date.now(),
    };

    setPresets((prev) => {
      const updated = [newPreset, ...prev];
      savePresets(updated);
      return updated;
    });

    return newPreset;
  }, [savePresets]);

  const importPresets = useCallback((imported: CustomPreset[]) => {
    setPresets((prev) => {
      // Merge by id, imported override existing
      const map = new Map<string, CustomPreset>();
      for (const p of prev) map.set(p.id, p);
      for (const p of imported) map.set(p.id, p);
      const merged = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
      savePresets(merged);
      return merged;
    });
  }, [savePresets]);

  const exportPresets = useCallback(() => {
    return presets;
  }, [presets]);

  const deletePreset = useCallback((id: string) => {
    setPresets((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      savePresets(updated);
      return updated;
    });
  }, [savePresets]);

  const updatePreset = useCallback((id: string, updates: Partial<Omit<CustomPreset, 'id' | 'createdAt'>>) => {
    setPresets((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
      savePresets(updated);
      return updated;
    });
  }, [savePresets]);

  return {
    presets,
    loading,
    addPreset,
    deletePreset,
    updatePreset,
    importPresets,
    exportPresets,
  };
}
