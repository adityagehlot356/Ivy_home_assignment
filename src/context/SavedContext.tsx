import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Listing, SavedItem } from '../types/api';
import { getSavedListings, saveListing, unsaveListing, getListingById } from '../services/dataService';
import { useAuth } from './AuthContext';

interface SavedContextType {
  savedIds: Set<string>;
  savedItems: SavedItem[];
  isLoading: boolean;
  isSaved: (id: string) => boolean;
  toggleSave: (listing: Listing) => Promise<void>;
  refreshSaved: () => Promise<void>;
}

const SavedContext = createContext<SavedContextType | undefined>(undefined);

export const SavedProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshSaved = useCallback(async () => {
    if (!isAuthenticated) {
      setSavedIds(new Set());
      setSavedItems([]);
      return;
    }

    setIsLoading(true);
    try {
      const items = await getSavedListings();
      const idSet = new Set<string>();

      // Populate full listing details if not returned directly by saved endpoint
      const populatedItems: SavedItem[] = await Promise.all(
        items.map(async (item) => {
          idSet.add(item.id);
          if (item.listing) return item;
          try {
            const l = await getListingById(item.id);
            return { id: item.id, listing: l };
          } catch {
            return item;
          }
        })
      );

      setSavedIds(idSet);
      setSavedItems(populatedItems);
    } catch (err) {
      console.warn('Failed to load saved items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshSaved();
  }, [isAuthenticated, user?.email, refreshSaved]);

  const isSaved = (id: string): boolean => {
    return savedIds.has(id);
  };

  const toggleSave = async (listing: Listing) => {
    const id = listing.listing_id;
    const currentlySaved = savedIds.has(id);

    // Optimistic UI update
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (currentlySaved) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    if (currentlySaved) {
      setSavedItems((prev) => prev.filter((item) => item.id !== id));
      try {
        await unsaveListing(id);
      } catch (err) {
        // Rollback
        setSavedIds((prev) => new Set(prev).add(id));
        setSavedItems((prev) => [...prev, { id, listing }]);
        throw err;
      }
    } else {
      setSavedItems((prev) => [...prev, { id, listing }]);
      try {
        await saveListing(id);
      } catch (err) {
        // Rollback
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setSavedItems((prev) => prev.filter((item) => item.id !== id));
        throw err;
      }
    }
  };

  return (
    <SavedContext.Provider
      value={{
        savedIds,
        savedItems,
        isLoading,
        isSaved,
        toggleSave,
        refreshSaved,
      }}
    >
      {children}
    </SavedContext.Provider>
  );
};

export const useSaved = (): SavedContextType => {
  const context = useContext(SavedContext);
  if (!context) {
    throw new Error('useSaved must be used within a SavedProvider');
  }
  return context;
};
