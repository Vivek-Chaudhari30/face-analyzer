/**
 * Decorative line-art profile with measurement guides. Original artwork,
 * used as a fallback when 3D is unavailable and as editorial decoration.
 * It depicts no real person.
 */
export function ProfileArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 520" className={className} role="img" aria-label="Illustrative line drawing of a facial profile with proportion guides">
      <defs>
        <linearGradient id="pa-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b08d57" stopOpacity="0.9" />
          <stop offset="1" stopColor="#b08d57" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Profile */}
        <path
          d="M178 30 C240 40 276 96 274 158 C273 178 276 188 270 204 C284 238 306 268 322 296 C326 306 316 314 296 316 C300 326 304 334 300 342 C294 346 294 352 300 358 C306 364 302 372 294 376 C288 382 288 394 296 406 C302 420 292 442 268 454 C246 464 240 492 236 520"
          stroke="url(#pa-fade)"
          strokeWidth="2.2"
        />
        {/* Guides */}
        <g stroke="#b08d57" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="3 5">
          <path d="M120 158 H356" />
          <path d="M120 204 H356" />
          <path d="M120 316 H356" />
          <path d="M120 406 H356" />
          <path d="M292 120 V470" />
        </g>
        <path d="M270 204 L322 296" stroke="#b08d57" strokeWidth="1.2" />
        <circle cx="270" cy="204" r="4" fill="#faf6ef" stroke="#b08d57" />
        <circle cx="322" cy="298" r="4" fill="#faf6ef" stroke="#b08d57" />
        <circle cx="296" cy="316" r="3" fill="#faf6ef" stroke="#b08d57" />
        <path d="M322 298 A52 52 0 0 0 340 262" stroke="#b08d57" strokeOpacity="0.6" />
      </g>
      <g fontFamily="Inter Variable, sans-serif" fontSize="9" letterSpacing="2" fill="#8b7d6b">
        <text x="124" y="152">GLABELLA</text>
        <text x="124" y="198">NASION</text>
        <text x="124" y="310">SUBNASALE</text>
        <text x="124" y="400">POGONION</text>
      </g>
    </svg>
  );
}
