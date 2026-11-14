// 線画アイコン（自作）。警察・消防・救急は色だけでなく形でも区別できるようにする。
import type { Kind } from '../app/store';

type P = { size?: number; className?: string; title?: string };

function Svg({ size = 20, className, title, children }: P & { children: React.ReactNode }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export const IconPolice = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l7 2.6v5.6c0 4.4-2.9 8.2-7 9.8-4.1-1.6-7-5.4-7-9.8V5.6L12 3z" />
    <path d="M12 8.2l1.2 2.5 2.7.3-2 1.9.6 2.7L12 14.3l-2.5 1.3.6-2.7-2-1.9 2.7-.3z" />
  </Svg>
);
export const IconFire = (p: P) => (
  <Svg {...p}>
    <path d="M12 21c-3.6 0-6.2-2.5-6.2-5.9 0-3.4 2.5-5.5 3.7-8.1.4 1.6 1.3 2.7 2.4 3.3.2-2.6 1.4-4.9 3.5-6.3-.2 2.7.9 4.4 2.1 6.1 1 1.4 1.7 2.9 1.7 4.9 0 3.5-2.9 6-7.2 6z" />
    <path d="M12 21c-1.6 0-2.7-1.1-2.7-2.6 0-1.7 1.4-2.6 2.1-4 .9 1 2.4 1.9 2.4 3.9 0 1.5-.8 2.7-1.8 2.7z" />
  </Svg>
);
export const IconEms = (p: P) => (
  <Svg {...p}>
    <path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z" />
  </Svg>
);
export const IconOther = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2.2" />
    <path d="M7.8 7.8a6 6 0 000 8.4M16.2 7.8a6 6 0 010 8.4M5 5a10 10 0 000 14M19 5a10 10 0 010 14" />
  </Svg>
);
export const KindIcon = ({ kind, ...p }: P & { kind: Kind }) =>
  kind === 'police' ? <IconPolice {...p} /> : kind === 'fire' ? <IconFire {...p} /> : kind === 'ems' ? <IconEms {...p} /> : <IconOther {...p} />;

export const IconGlobe = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5S9.6 5.9 12 3.5z" />
  </Svg>
);
export const IconTower = (p: P) => (
  <Svg {...p}>
    <path d="M12 10.5L8 21M12 10.5L16 21M9.6 17h4.8" />
    <circle cx="12" cy="9" r="1.6" />
    <path d="M8.2 5.2a5.4 5.4 0 000 7.6M15.8 5.2a5.4 5.4 0 010 7.6M5.6 2.8a9 9 0 000 12.4M18.4 2.8a9 9 0 010 12.4" />
  </Svg>
);
export const IconWave = (p: P) => (
  <Svg {...p}>
    <path d="M3 12h2.2l1.6-4.5 2.6 10 2.8-13 2.6 12 1.7-4.5H21" />
  </Svg>
);
export const IconStar = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Svg {...p}>
    <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill={filled ? 'currentColor' : 'none'} />
  </Svg>
);
export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconSliders = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Svg>
);
export const IconPlay = (p: P) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconStop = (p: P) => (
  <Svg {...p}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconSpeaker = (p: P) => (
  <Svg {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Svg>
);
export const IconFile = (p: P) => (
  <Svg {...p}>
    <path d="M7 3.5h7l4 4V20.5H7z" />
    <path d="M14 3.5v4h4M10 13.5l2-1.5v6M10 18h4" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const IconBack = (p: P) => (
  <Svg {...p}>
    <path d="M14.5 5.5L8 12l6.5 6.5" />
  </Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" />
  </Svg>
);
