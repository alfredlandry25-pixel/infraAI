function PersonBust({ x = 0, y = 0, scale = 1, skin = "#8B5E3C", hair = "#20140C", outfit = "var(--primary)", flip = false }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      <path d="M-34 60 Q-34 10 0 10 Q34 10 34 60 L34 74 L-34 74 Z" fill={outfit} />
      <rect x="-8" y="-6" width="16" height="20" fill={skin} />
      <circle cx="0" cy="-24" r="26" fill={skin} />
      <path
        d="M-27 -32 Q-32 -58 -8 -64 Q-4 -74 12 -72 Q30 -66 26 -50
           Q34 -42 28 -30 Q30 -44 22 -50 Q24 -62 8 -66
           Q0 -76 -12 -70 Q-24 -64 -20 -50 Q-30 -44 -27 -32 Z"
        fill={hair}
      />
      <circle cx="-8" cy="-22" r="2.2" fill="var(--background)" />
      <circle cx="8" cy="-22" r="2.2" fill="var(--background)" />
      <path d="M-6 -12 Q0 -8 6 -12" stroke="var(--background)" strokeWidth="2" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Glow({ cx = 200, cy = 150, r = 140 }) {
  return (
    <>
      <defs>
        <radialGradient id={`glow-${cx}-${cy}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#glow-${cx}-${cy})`} />
    </>
  );
}

export function HeroIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 400 320" className={className} xmlns="http://www.w3.org/2000/svg">
      <Glow cx={200} cy={140} r={150} />
      <ellipse cx="200" cy="266" rx="150" ry="14" fill="var(--primary)" opacity="0.08" />
      <rect x="70" y="238" width="260" height="10" rx="4" fill="var(--border-strong)" />
      <rect x="90" y="248" width="10" height="34" fill="var(--border-strong)" />
      <rect x="300" y="248" width="10" height="34" fill="var(--border-strong)" />
      <rect x="145" y="180" width="110" height="72" rx="7" fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth="2" />
      <rect x="154" y="189" width="92" height="52" rx="3" fill="var(--background)" />
      <circle cx="180" cy="204" r="7" fill="var(--primary)" />
      <circle cx="224" cy="204" r="7" fill="var(--primary-glow)" />
      <circle cx="202" cy="230" r="7" fill="var(--primary)" opacity="0.7" />
      <line x1="180" y1="204" x2="202" y2="230" stroke="var(--primary)" strokeWidth="2" />
      <line x1="224" y1="204" x2="202" y2="230" stroke="var(--primary-glow)" strokeWidth="2" />
      <PersonBust x={200} y={252} scale={1.15} />
    </svg>
  );
}

export function CollabIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 420 280" className={className} xmlns="http://www.w3.org/2000/svg">
      <Glow cx={210} cy={120} r={150} />
      <rect x="90" y="70" width="240" height="140" rx="14" fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth="2" />
      <circle cx="150" cy="120" r="10" fill="var(--primary)" />
      <circle cx="230" cy="105" r="10" fill="var(--primary-glow)" />
      <circle cx="270" cy="150" r="10" fill="var(--primary)" opacity="0.75" />
      <circle cx="180" cy="170" r="10" fill="var(--primary-glow)" opacity="0.75" />
      <line x1="150" y1="120" x2="230" y2="105" stroke="var(--primary)" strokeWidth="2" />
      <line x1="230" y1="105" x2="270" y2="150" stroke="var(--primary-glow)" strokeWidth="2" />
      <line x1="270" y1="150" x2="180" y2="170" stroke="var(--primary)" strokeWidth="2" opacity="0.7" />
      <circle cx="150" cy="120" r="4" fill="var(--card)" />
      <ellipse cx="72" cy="232" rx="46" ry="10" fill="var(--primary)" opacity="0.06" />
      <ellipse cx="348" cy="232" rx="46" ry="10" fill="var(--primary)" opacity="0.06" />
      <PersonBust x={72} y={214} scale={0.95} outfit="var(--primary)" />
      <PersonBust x={348} y={214} scale={0.95} outfit="var(--secondary)" skin="#6B4423" flip />
    </svg>
  );
}

export function ChatIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 400 280" className={className} xmlns="http://www.w3.org/2000/svg">
      <Glow cx={200} cy={130} r={140} />
      <rect x="150" y="30" width="200" height="120" rx="18" fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth="2" />
      <path d="M190 150 L170 178 L212 150 Z" fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth="2" />
      <circle cx="200" cy="70" r="6" fill="var(--primary)" />
      <circle cx="240" cy="70" r="6" fill="var(--primary-glow)" />
      <circle cx="220" cy="100" r="6" fill="var(--primary)" opacity="0.8" />
      <line x1="200" y1="70" x2="220" y2="100" stroke="var(--primary)" strokeWidth="2" />
      <line x1="240" y1="70" x2="220" y2="100" stroke="var(--primary-glow)" strokeWidth="2" />
      <rect x="188" y="118" width="120" height="8" rx="4" fill="var(--border)" />
      <rect x="188" y="132" width="80" height="8" rx="4" fill="var(--border)" />
      <PersonBust x={110} y={220} scale={1.3} />
    </svg>
  );
}

export function DocIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 400 280" className={className} xmlns="http://www.w3.org/2000/svg">
      <Glow cx={200} cy={130} r={140} />
      <rect x="140" y="40" width="150" height="190" rx="10" fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth="2" />
      <rect x="160" y="64" width="80" height="10" rx="4" fill="var(--primary)" />
      <rect x="160" y="88" width="110" height="6" rx="3" fill="var(--border)" />
      <rect x="160" y="102" width="110" height="6" rx="3" fill="var(--border)" />
      <rect x="160" y="116" width="70" height="6" rx="3" fill="var(--border)" />
      <rect x="160" y="140" width="110" height="6" rx="3" fill="var(--border)" />
      <rect x="160" y="154" width="90" height="6" rx="3" fill="var(--border)" />
      <circle cx="168" cy="182" r="5" fill="var(--primary-glow)" />
      <rect x="180" y="178" width="70" height="8" rx="4" fill="var(--border)" />
      <PersonBust x={300} y={224} scale={1.1} skin="#6B4423" outfit="var(--secondary)" />
    </svg>
  );
}