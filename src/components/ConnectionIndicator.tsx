/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useOnlineStatus, ConnectionStatus } from '@/hooks/useOnlineStatus';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

const CONFIG: Record<ConnectionStatus, { label: string; icon: typeof Wifi; colorClass: string }> = {
  online: { label: 'Online', icon: Wifi, colorClass: 'bg-green-500' },
  offline: { label: 'Offline', icon: WifiOff, colorClass: 'bg-destructive' },
  syncing: { label: 'Sincronizando...', icon: RefreshCw, colorClass: 'bg-amber-500' },
};

export function ConnectionIndicator() {
  const status = useOnlineStatus();
  const { label, icon: Icon, colorClass } = CONFIG[status];

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className={`w-2 h-2 rounded-full ${colorClass} ${status === 'syncing' ? 'animate-pulse' : ''}`} />
      <Icon className={`h-3 w-3 ${status === 'offline' ? 'text-destructive' : 'text-muted-foreground'}`} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
