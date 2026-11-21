import React, { createContext, useContext, useEffect } from 'react';

export type ZoomLevel = 100;

interface ZoomContextType {
  zoom: number;
  setZoom: (level: number) => void;
}

const ZoomContext = createContext<ZoomContextType | undefined>(undefined);

export function ZoomProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      localStorage.removeItem('iz_zoom');
      document.documentElement.style.zoom = '';
    } catch (e) {}
  }, []);

  return (
    <ZoomContext.Provider value={{ zoom: 100, setZoom: () => {} }}>
      {children}
    </ZoomContext.Provider>
  );
}

export function useZoom() {
  const context = useContext(ZoomContext);
  if (!context) {
    return { zoom: 100, setZoom: () => {} };
  }
  return context;
}

