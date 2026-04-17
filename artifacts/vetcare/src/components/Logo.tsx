export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size * 3.5} height={size} viewBox="0 0 140 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="14" width="12" height="12" rx="2" fill="#2D6A9F"/>
      <rect x="8" y="8" width="12" height="12" rx="2" fill="#2D6A9F" opacity="0.7"/>
      <rect x="8" y="20" width="12" height="12" rx="2" fill="#27AE60"/>
      <text x="28" y="28" fontFamily="system-ui, sans-serif" fontSize="20" fontWeight="700" fill="#2D6A9F">Véto</text>
      <text x="82" y="28" fontFamily="system-ui, sans-serif" fontSize="20" fontWeight="700" fill="#27AE60">AI</text>
    </svg>
  );
}
