import { useState, useEffect } from 'react';

// Memorizza le funzioni da chiamare ad ogni cambio di rotta
const navigationListeners = new Set<() => void>();

// Naviga verso un nuovo indirizzo modificando la cronologia del browser
export function navigate(to: string) {
  window.history.pushState(null, '', to);
  navigationListeners.forEach((listener) => listener());
}

// Hook per ascoltare i cambiamenti della URL corrente
export function useLocation() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    const handleNavigationEvent = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    navigationListeners.add(handleNavigationEvent);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      navigationListeners.delete(handleNavigationEvent);
    };
  }, []);

  return currentPath;
}
