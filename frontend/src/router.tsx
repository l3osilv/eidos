import { useState, useEffect } from 'react';

// Set di listener da notificare ad ogni navigate() — usato per sincronizzare
// l'hook useLocation senza dipendere da un router esterno
const navigationListeners = new Set<() => void>();

// Aggiorna la URL del browser e notifica tutti i listener
export function navigate(to: string) {
  window.history.pushState(null, '', to);
  navigationListeners.forEach((listener) => listener());
}

// Hook che espone il pathname corrente e si aggiorna ad ogni navigate()
// o pressione del bottone indietro del browser
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
