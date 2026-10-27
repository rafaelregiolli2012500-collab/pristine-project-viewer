/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
import { useEditLock } from '@/hooks/useEditLock';
import { Lock, Unlock, Eye, AlertTriangle } from 'lucide-react';

export function EditLockBanner() {
  const { isEditor, otherTabActive, wasForceDisconnected } = useEditLock();

  if (!otherTabActive && isEditor) return null;

  if (isEditor && otherTabActive) {
    return (
      <div className="bg-green-50 border-b border-green-200 px-4 py-1.5 flex items-center gap-2 text-xs text-green-700">
        <Unlock className="h-3.5 w-3.5" />
        <span><strong>Modo Edição.</strong> Outros usuários estão visualizando o sistema.</span>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center gap-2 text-xs text-amber-700">
      {wasForceDisconnected ? (
        <>
          <AlertTriangle className="h-3.5 w-3.5" />
          <span><strong>Você foi desconectado por outro usuário.</strong> Modo visualização ativo.</span>
        </>
      ) : (
        <>
          <Eye className="h-3.5 w-3.5" />
          <span><strong>Modo Visualização.</strong> Outro usuário está editando o sistema.</span>
        </>
      )}
      <Lock className="h-3 w-3 ml-auto" />
    </div>
  );
}

export { useEditLock };
