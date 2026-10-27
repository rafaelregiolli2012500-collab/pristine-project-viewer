/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useEffect, useState } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';

type DesktopBridge = {
  isDesktop?: boolean;
  minimize?: () => void;
  toggleMaximize?: () => void;
  close?: () => void;
  isMaximized?: () => Promise<boolean>;
  onMaximizeChange?: (cb: (v: boolean) => void) => () => void;
};

function bridge(): DesktopBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { monitCampo?: DesktopBridge }).monitCampo;
}

/** Controles nativos da janela (somente no app desktop). */
export function WindowControls() {
  const [api, setApi] = useState<DesktopBridge | undefined>(undefined);
  const [maximized, setMaximized] = useState(true);

  useEffect(() => {
    const b = bridge();
    if (!b?.isDesktop) return;
    setApi(b);
    b.isMaximized?.().then(setMaximized).catch(() => undefined);
    return b.onMaximizeChange?.(setMaximized);
  }, []);

  if (!api) return null;

  const btn =
    'flex h-8 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground';

  return (
    <div
      className="ml-1 flex items-center gap-1 select-none"
      style={{ ['-webkit-app-region' as any]: 'no-drag' }}
    >
      <button type="button" aria-label="Minimizar" title="Minimizar" className={btn} onClick={() => api.minimize?.()}>
        <Minus className="size-4" />
      </button>
      <button
        type="button"
        aria-label={maximized ? 'Restaurar' : 'Maximizar'}
        title={maximized ? 'Restaurar' : 'Maximizar'}
        className={btn}
        onClick={() => api.toggleMaximize?.()}
      >
        {maximized ? <Copy className="size-3.5" /> : <Square className="size-3.5" />}
      </button>
      <button
        type="button"
        aria-label="Fechar"
        title="Fechar"
        className={`${btn} hover:bg-destructive hover:text-destructive-foreground`}
        onClick={() => api.close?.()}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}