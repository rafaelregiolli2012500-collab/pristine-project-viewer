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

/** Dentes da engrenagem do ícone de dashboard, calculados em torno do centro. */
const GEAR = { cx: 23.8, cy: 11.4, body: 4.4, tip: 5.9 };
const GEAR_TEETH = [0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x1: GEAR.cx + GEAR.body * cos,
    y1: GEAR.cy - GEAR.body * sin,
    x2: GEAR.cx + GEAR.tip * cos,
    y2: GEAR.cy - GEAR.tip * sin,
  };
});

/**
 * Barras de gráfico crescendo sobre a linha de base + engrenagem de operações.
 * Mesmo traço outline dos demais ícones: currentColor, cantos arredondados.
 */
export const FleetDashboardIcon = ({ className, strokeWidth = 1.9 }: IconProps) => (
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
    <path d="M3.6 27.4h25.4" />
    <rect x="4.2" y="18.8" width="3.2" height="8.6" rx="1" fill="currentColor" fillOpacity="0.14" />
    <rect x="9" y="14.6" width="3.2" height="12.8" rx="1" fill="currentColor" fillOpacity="0.14" />
    <rect x="13.8" y="10.4" width="3.2" height="17" rx="1" fill="currentColor" fillOpacity="0.14" />
    <rect x="18.4" y="19.6" width="2.9" height="7.8" rx="1" fill="currentColor" fillOpacity="0.14" />
    <rect x="22.1" y="18.2" width="2.9" height="9.2" rx="1" fill="currentColor" fillOpacity="0.14" />
    <rect x="25.8" y="20.6" width="2.9" height="6.8" rx="1" fill="currentColor" fillOpacity="0.14" />
    <circle cx={GEAR.cx} cy={GEAR.cy} r={GEAR.body} />
    <circle cx={GEAR.cx} cy={GEAR.cy} r="1.7" />
    {GEAR_TEETH.map((t, i) => (
      <path key={i} d={`M${t.x1.toFixed(2)} ${t.y1.toFixed(2)}L${t.x2.toFixed(2)} ${t.y2.toFixed(2)}`} />
    ))}
  </svg>
);