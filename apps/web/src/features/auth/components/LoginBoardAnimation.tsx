import { cn } from '@/lib/utils';
import './login-board-animation.css';

const COLUMNS = [
  { className: 'lba-col-1', dot: 'bg-status-todo', label: 'À faire' },
  { className: 'lba-col-2', dot: 'bg-status-progress', label: 'En cours' },
  { className: 'lba-col-3', dot: 'bg-status-done', label: 'Terminé' },
];

/**
 * Animation décorative du panneau de connexion (12 s, en boucle) : du désordre
 * à un board rangé, puis une carte qui traverse le flux jusqu'à sa validation.
 * Les cartes restent abstraites. Toute la chorégraphie vit dans le CSS ; sans
 * animation (préférence système), la scène s'affiche dans son état final.
 */
export function LoginBoardAnimation() {
  return (
    <div aria-hidden="true" className="lba-stage">
      <div className="lba-scene">
        <div className="lba-frame" />
        <div className="lba-board" />

        <div className="lba-header">
          <span className="text-ink-700 shrink-0 text-[11px] font-semibold">Sprint 2</span>
          <span className="lba-track">
            <span className="lba-fill" />
          </span>
          <span className="lba-pct text-ink-500 text-[10px] font-semibold tabular-nums">
            <span className="lba-pct-40">40 %</span>
            <span className="lba-pct-60">60 %</span>
            <span className="lba-pct-80">80 %</span>
          </span>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.label} className={cn('lba-col', column.className)}>
            <div className="lba-col-head">
              <span className={cn('size-1.5 rounded-full', column.dot)} />
              <span className="text-ink-600 text-[10px] font-semibold">{column.label}</span>
            </div>
          </div>
        ))}

        <div className="lba-placeholder" />

        <AbstractCard className="lba-card-a" chip="bg-green-100" avatar="#8764b8" />
        <AbstractCard className="lba-card-b" chip="bg-orange-100" avatar="#005a9e" />
        <AbstractCard className="lba-card-c" chip="bg-red-100" avatar="#498205" />
        <AbstractCard className="lba-card-move" chip="bg-accent-100" avatar="#038387">
          <span className="lba-check">✓</span>
        </AbstractCard>

        <svg className="lba-cursor" viewBox="0 0 24 24">
          <path
            d="M5 3l14 7.5-6.2 1.6 3.6 6.6-2.7 1.4-3.6-6.6L5 18z"
            fill="#fff"
            stroke="#1c1b1a"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

/** Carte sans contenu réel : pastille de couleur, lignes grises, avatar. */
function AbstractCard({
  className,
  chip,
  avatar,
  children,
}: {
  className: string;
  chip: string;
  avatar: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('lba-card flex flex-col justify-between px-2.5 py-2', className)}>
      <span className="flex flex-col gap-[5px]">
        <span className={cn('block h-2 w-10 rounded-full', chip)} />
        <span className="bg-border-default block h-1.5 w-full rounded-full" />
        <span className="bg-border-default block h-1.5 w-2/3 rounded-full" />
      </span>
      <span className="flex items-center justify-between">
        <span className="bg-surface-sunken block h-1.5 w-8 rounded-full" />
        <span className="block size-2.5 rounded-full" style={{ backgroundColor: avatar }} />
      </span>
      {children}
    </div>
  );
}
