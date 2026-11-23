import type { Service } from "../data/services";

/** Line-art profile with a gold highlight on the region a service relates to. Original artwork, no real person. */
const PROFILE =
  "M178 30 C240 40 276 96 274 158 C273 178 276 188 270 204 C284 238 306 268 322 296 C326 306 316 314 296 316 C300 326 304 334 300 342 C294 346 294 352 300 358 C306 364 302 372 294 376 C288 382 288 394 296 406 C302 420 292 442 268 454 C246 464 240 492 236 520";

const SPOTS: Record<Service["focus"], { cx: number; cy: number; r: number }> = {
  nose: { cx: 308, cy: 292, r: 34 },
  lips: { cx: 296, cy: 348, r: 28 },
  chin: { cx: 292, cy: 408, r: 30 },
  jaw: { cx: 262, cy: 446, r: 38 },
  cheek: { cx: 238, cy: 252, r: 44 },
  brow: { cx: 262, cy: 172, r: 30 },
  eye: { cx: 248, cy: 214, r: 28 },
  neck: { cx: 240, cy: 490, r: 40 },
  skin: { cx: 236, cy: 260, r: 120 },
  body: { cx: 200, cy: 280, r: 0 },
};

export function ServiceArt({ focus, className = "" }: { focus: Service["focus"]; className?: string }) {
  const spot = SPOTS[focus];
  return (
    <svg viewBox="40 10 360 540" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true" focusable="false">
      {focus === "body" ? (
        <g fill="none" stroke="#b08d57" strokeWidth="2" strokeLinecap="round">
          <path d="M200 70c-24 0-40 18-40 42s14 44 40 44 40-20 40-44-16-42-40-42Z" />
          <path d="M150 190c-34 12-52 50-54 110l8 190M250 190c34 12 52 50 54 110l-8 190M150 190c20 22 80 22 100 0M150 190l12 150c8 24 12 44 12 150M250 190l-12 150c-8 24-12 44-12 150" opacity=".85" />
          <ellipse cx="200" cy="330" rx="70" ry="38" strokeDasharray="4 7" opacity=".6" />
        </g>
      ) : (
        <>
          <path d={PROFILE} fill="none" stroke="#b08d57" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={spot.cx} cy={spot.cy} r={spot.r} fill="#b08d57" fillOpacity="0.12" stroke="#b08d57" strokeOpacity="0.7" strokeWidth="1.2" strokeDasharray="4 5" />
          <circle cx={spot.cx} cy={spot.cy} r="4" fill="#faf6ef" stroke="#b08d57" />
        </>
      )}
    </svg>
  );
}
