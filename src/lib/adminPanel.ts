/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * Abertura do Painel Central (Central Admin).
 * No app instalado (Electron) abre em janela própria;
 * na versão web (prévia/navegador) abre em nova aba.
 * A URL oficial vive em electron/main.cjs — mantenha as duas iguais.
 */
export const CENTRAL_ADMIN_URL = 'https://monit-field-guard.lovable.app';

export function openAdminPanel(): void {
  if (typeof window === 'undefined') return;
  if (window.monitCampo?.openAdminPanel) {
    window.monitCampo.openAdminPanel();
    return;
  }
  window.open(CENTRAL_ADMIN_URL, '_blank', 'noopener,noreferrer');
}
