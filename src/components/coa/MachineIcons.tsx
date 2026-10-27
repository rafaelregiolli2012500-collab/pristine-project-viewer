/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 */
/**
 * Ícones outline "neon" no estilo de dashboards industriais premium.
 * Puramente visuais — traços grossos, cantos arredondados, currentColor.
 */

type IconProps = { className?: string; strokeWidth?: number };

const base = (className?: string) => `${className ?? ''}`.trim();

export const HarvesterIcon = ({ className, strokeWidth = 1.9 }: IconProps) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={base(className)}
    aria-hidden="true"
  >
    <path d="M6 12.5h3.2a2 2 0 0 0 2-2V7.6a1.6 1.6 0 0 1 1.6-1.6h4.4A1.6 1.6 0 0 1 18.8 7.6v6.9" />
    <path d="M18.8 10.5h4.6a2.6 2.6 0 0 1 2.6 2.6v4.4" />
    <path d="M11.2 14.5h11.6a2 2 0 0 1 2 2v1.8H9.2v-1.8a2 2 0 0 1 2-2Z" />
    <path d="M6 12.5v5.8" />
    <path d="M3.6 21.5h9.6" />
    <path d="M4.4 25.4h8" />
    <circle cx="21.6" cy="23" r="3.4" />
    <circle cx="8.6" cy="23.4" r="0.6" fill="currentColor" stroke="none" />
    <path d="M26 18.5v4" />
  </svg>
);

export const TractorIcon = ({ className, strokeWidth = 1.9 }: IconProps) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={base(className)}
    aria-hidden="true"
  >
    <path d="M11 7h6.2a1.6 1.6 0 0 1 1.55 1.2L20 13.4" />
    <path d="M11 7v6.4" />
    <path d="M8.4 13.4h13.2a2 2 0 0 1 2 2v2.2" />
    <path d="M8.4 13.4v3.4" />
    <circle cx="10.4" cy="21.6" r="5" />
    <circle cx="10.4" cy="21.6" r="1.4" />
    <circle cx="23.4" cy="22.6" r="3.4" />
    <path d="M26.8 19.2V15" />
  </svg>
);

export const TruckIcon = ({ className, strokeWidth = 1.9 }: IconProps) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={base(className)}
    aria-hidden="true"
  >
    <path d="M3 9.4h13.4a1.6 1.6 0 0 1 1.6 1.6v10.4H3z" />
    <path d="M18 13.6h4.6a2 2 0 0 1 1.68.92l2.5 3.9a2 2 0 0 1 .32 1.08v1.9H18z" />
    <circle cx="9" cy="23.6" r="2.8" />
    <circle cx="22.6" cy="23.6" r="2.8" />
    <path d="M11.8 21.4h8" />
    <path d="M6 13.6h6" />
  </svg>
);