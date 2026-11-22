"""Face proportions and slider optimizer for the ARKit front-face mesh.

ARFaceGeometry has the same 1,220 vertices in the same order for every person
(docs/DATA_CONTRACT.md), so landmarks are fixed vertex indexes. No clicking.
The indexes below were picked on shared/samples/face-mesh-1.json and checked
against the mirror pairs, the eye and mouth openings, and a profile render.

All lengths are millimetres in ARKit face-local axes (+x right, +y up, +z out).
"""
from dataclasses import replace
import numpy as np
from scipy.optimize import least_squares
from geometry import Nose, Chin, Controls

ARKIT_VERTEX_COUNT = 1220
LM = dict(
    tip=7,               # pronasale: most forward vertex of the nose
    nasion=16,           # deepest point of the nasal root on the midline
    dorsum=12,           # middle of the nasal bridge ridge
    subnasale=2,         # where the nose base meets the upper lip
    columella=38,        # lower columella, above subnasale
    upper_lip=21,        # most forward point of the upper lip
    stomion=24,          # centre of the closed mouth
    lower_lip=27,        # most forward point of the lower lip
    pogonion=975,        # chin front, a little above the lowest point
    menton=1047,         # lowest point of the chin
    alare_l=325, alare_r=760,   # outer edges of the nostril wings
    canthus_l=1089, canthus_r=1081,  # inner eye corners
)
# What the five NoseStudio clicks mean: wing A, wing B, tip, bridge, nose base.
NOSE_MARKS = ("alare_l", "alare_r", "tip", "dorsum", "subnasale")

# name: (target, tolerance, weight, what it means, side)
# Tolerance is how far off counts as "one unit" of error. side +1 only penalizes
# values above the target, since the bridge slider can only lower a hump.
# Targets come from the rhinoplasty and facial-canon literature; they are norms,
# not laws.
TARGETS = {
    "alar_icd":   (1.00, 0.05, 2.0, "Nose width / eye gap (canon: equal)", 0),
    "goode":      (0.575, 0.03, 1.0, "Tip projection / nose length (Goode 0.55-0.60)", 0),
    "dorsum_mm":  (0.0, 1.0, 1.0, "Bridge hump vs straight line (mm)", 1),
    "thirds":     (1.00, 0.06, 1.0, "Mid third / lower third of face", 0),
    "lip_chin":   (0.46, 0.04, 1.5, "Upper lip / (mouth to chin) (canon 1:2 = 0.50)", 0),
    "e_upper_mm": (-4.0, 2.0, 0.7, "Upper lip vs nose-chin line (mm)", 0),
    "e_lower_mm": (-2.0, 2.0, 0.7, "Lower lip vs nose-chin line (mm)", 0),
}

# (slider, low, high) for the sliders the optimizer may move. Each one has a
# metric above that it changes. Round tip and tip rotation are not here: no
# metric measures them, so the optimizer would use them as free knobs.
FREE = [
    ("bridge", 0, 6), ("projection", -6, 6),
    ("wing_a", 0, 5), ("wing_b", 0, 5),
    ("chin_length", -6, 6), ("chin_projection", -6, 6),
]
# Sliders each region's "original to ideal" blend moves. Round tip and rotation
# stay under manual control.
REGIONS = {
    "nose": ("bridge", "projection", "wing_a", "wing_b"),
    "chin": ("chin_length", "chin_projection"),
}


def is_arkit(points):
    return len(points) == ARKIT_VERTEX_COUNT


def mark_points(points):
    return np.array([points[LM[k]] for k in NOSE_MARKS], dtype=float)


def _signed_offset(p, a, b):
    """Distance in the y-z plane of p from line a-b. Positive means in front."""
    d = b - a
    n = np.array([-d[1], d[0]]) / np.linalg.norm(d)
    if n[1] < 0:
        n = -n
    return float((p - a) @ n)


def measure(points):
    """Proportions of a mesh in mm. Returns {metric name: value}."""
    P = {k: points[i] for k, i in LM.items()}
    yz = lambda a, b: float(np.linalg.norm((P[a] - P[b])[1:]))
    alar = abs(P["alare_r"][0] - P["alare_l"][0])
    icd = abs(P["canthus_r"][0] - P["canthus_l"][0])
    projection = P["tip"][2] - 0.5 * (P["alare_l"][2] + P["alare_r"][2])
    lower = abs(P["subnasale"][1] - P["menton"][1])
    return {
        "alar_icd": alar / icd,
        "goode": projection / yz("nasion", "tip"),
        "dorsum_mm": _signed_offset(P["dorsum"][1:], P["nasion"][1:], P["tip"][1:]),
        "thirds": abs(P["nasion"][1] - P["subnasale"][1]) / lower,
        "lip_chin": abs(P["subnasale"][1] - P["stomion"][1]) / abs(P["stomion"][1] - P["menton"][1]),
        "e_upper_mm": _signed_offset(P["upper_lip"][1:], P["tip"][1:], P["pogonion"][1:]),
        "e_lower_mm": _signed_offset(P["lower_lip"][1:], P["tip"][1:], P["pogonion"][1:]),
    }


def deviation(name, value):
    """Error in tolerance units. Zero means on target."""
    target, tol, _, _, side = TARGETS[name]
    d = (value - target) / tol
    return max(d, 0) if side > 0 else min(d, 0) if side < 0 else d


def penalty(values):
    """Weighted squared distance from the targets. Lower is better balanced."""
    return float(sum(TARGETS[k][2] * deviation(k, values[k]) ** 2 for k in TARGETS))


class Face:
    """The editable ARKit face: nose and chin deformations on one mesh."""

    def __init__(self, points):
        if not is_arkit(points):
            raise ValueError("Auto-balance needs an ARFaceGeometry export (1,220 vertices).")
        self.points = np.asarray(points, dtype=float)
        self.nose = Nose(self.points, mark_points(self.points))
        self.chin = Chin(self.points)

    def deform(self, c):
        return self.nose.deform(c) + (self.chin.deform(c) - self.points)


def find_ideal(points, limit=0.5, comfort=0.15):
    """Choose slider values that bring the proportions closest to TARGETS.

    limit   share of each slider's travel the optimizer may use (0..1).
    comfort pull toward doing less: bigger values give subtler results.
    Returns (Controls, before metrics, after metrics).
    """
    face = Face(points)
    names = [n for n, _, _ in FREE]
    lo = np.array([l * limit if l < 0 else l for _, l, _ in FREE], float)
    hi = np.array([h * limit for _, _, h in FREE], float)
    span = np.array([h - l for _, l, h in FREE], float)

    def controls(x):
        return replace(Controls(), **dict(zip(names, x)))

    def residuals(x):
        m = measure(face.deform(controls(x)))
        r = [np.sqrt(TARGETS[k][2]) * deviation(k, m[k]) for k in TARGETS]
        r += list(np.sqrt(comfort) * x / span * 6)
        return np.array(r)

    best = None
    for start in (np.zeros(len(names)), (lo + hi) / 2):
        fit = least_squares(residuals, np.clip(start, lo, hi), bounds=(lo, hi),
                            diff_step=1e-3)
        if best is None or fit.cost < best.cost:
            best = fit
    ideal = controls(best.x)
    return ideal, measure(face.points), measure(face.deform(ideal))


def report(before, after):
    rows = [f"{'':46s}{'before':>8s}{'after':>8s}{'target':>8s}"]
    for k, (t, tol, w, text, side) in TARGETS.items():
        rows.append(f"{text:46s}{before[k]:8.2f}{after[k]:8.2f}{t:8.2f}")
    rows.append(f"{'Balance score (lower is better)':46s}{penalty(before):8.1f}{penalty(after):8.1f}")
    return "\n".join(rows)
