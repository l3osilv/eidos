import { useState, useEffect } from 'react';

// Mantengo un array di listener per gestire il cambio di rotta.
// Ho preferito creare questo custom hook invece di installare react-router, che era eccessivo per poche pagine.
const navigationListeners = new Set<() => void>();

// Aggiorno la history del browser e notifico i componenti in ascolto
export function navigate(to: string) {
  window.history.pushState(null, '', to);
  navigationListeners.forEach((listener) => listener());
}

// Hook custom per leggere l'URL corrente. Causa un re-render in automatico se chiamo navigate()
// o se l'utente usa il tasto "Indietro" del browser.
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
