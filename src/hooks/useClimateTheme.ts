/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useEffect, useState } from 'react';

const KEY = 'climate_theme_enabled';

export function useClimateTheme() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch {}
    if (enabled) {
      document.body.classList.add('climate-theme');
    } else {
      document.body.classList.remove('climate-theme');
    }
  }, [enabled]);

  return { enabled, toggle: () => setEnabled(v => !v), setEnabled };
}
