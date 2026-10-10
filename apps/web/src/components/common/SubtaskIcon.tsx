import type { SVGProps } from 'react';

/**
 * Pictogramme des sous-tâches : presse-papiers plein à pince, coche blanche
 * (même dessin que l'icône « Task » d'Azure DevOps). La couleur suit
 * `currentColor` — jeton `text-subtask`.
 */
export function SubtaskIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" role="img" {...props}>
      {/* Corps du presse-papiers */}
      <rect x="2.5" y="3" width="11" height="12" rx="1.6" fill="currentColor" />
      {/* Pince : anneau au-dessus du corps */}
      <path
        d="M6 3.4V2.6C6 1.72 6.9 1 8 1s2 .72 2 1.6v.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect x="5.25" y="2.6" width="5.5" height="2" rx="0.8" fill="currentColor" />
      {/* Coche */}
      <path
        d="M5.3 9.7l1.9 1.9 3.6-4.3"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
