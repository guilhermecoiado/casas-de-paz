export function Logo({ size = 64, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <rect width="100" height="100" rx="26" fill="#C8553D" />
      <path
        d="M50 18 L82 45 L74 45 L74 80 L26 80 L26 45 L18 45 Z"
        fill="#FBF6EE"
        stroke="#FBF6EE"
        strokeWidth="3"
        strokeLinejoin="round"
        style={animated ? { strokeDasharray: 400, animation: 'drawStroke 1s ease-out both' } : undefined}
      />
      <path
        d="M50 72 C36 62 39 50 46 52 C48.5 52.6 50 55 50 56 C50 55 51.5 52.6 54 52 C61 50 64 62 50 72 Z"
        fill="#C8553D"
        style={animated ? { transformOrigin: '50px 60px', animation: 'popIn .6s .5s both' } : undefined}
      />
      <circle cx="74" cy="24" r="5" fill="#F2A541" />
    </svg>
  );
}
