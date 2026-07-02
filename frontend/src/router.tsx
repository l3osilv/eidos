import { useState, useEffect } from 'react';

// Gestione minimale del routing client-side senza dipendenze esterne
const navigationListeners = new Set<() => void>();

export function navigate(to: string) {
  window.history.pushState(null, '', to);
  navigationListeners.forEach((listener) => listener());
}

export function useLocation() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    navigationListeners.add(handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      navigationListeners.delete(handleLocationChange);
    };
  }, []);

  return currentPath;
}
