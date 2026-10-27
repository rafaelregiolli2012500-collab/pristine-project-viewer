/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useState, useEffect } from 'react';

export type ConnectionStatus = 'online' | 'offline' | 'syncing';

export function useOnlineStatus() {
  const [status, setStatus] = useState<ConnectionStatus>(
    navigator.onLine ? 'online' : 'offline'
  );

  useEffect(() => {
    const handleOnline = () => {
      setStatus('syncing');
      // Simula sincronização
      setTimeout(() => setStatus('online'), 1500);
    };
    const handleOffline = () => setStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}
