"""All displacements are in mm in a head-local, right/up/forward frame."""
from dataclasses import dataclass
import numpy as np


@dataclass
class Controls:
    bridge: float = 0
    width: float = 10
    roundness: float = 0
    projection: float = 0
    rotation: float = 0
    wing_a: float = 0
    wing_b: float = 0


def unit(v):
    length = np.linalg.norm(v)
    if length < 1e-6:
        raise ValueError("Landmarks overlap or are collinear. Please pick again.")
    return v / length


def falloff(offset, radii):
    # Compact, smooth support on an ellipsoid.
    r2 = np.sum((offset / radii) ** 2, axis=1)
    return np.maximum(0, 1 - r2) ** 3


class Nose:
    def __init__(self, points, marks):
        a, b, tip, bridge, pivot = np.asarray(marks, dtype=float)
        x = unit(b - a)
        z = unit(np.cross(x, bridge - pivot))
        if (tip - pivot) @ z < 0:
            z = -z
        y = unit(np.cross(z, x))
        if (bridge - pivot) @ y < 0:
            y = -y
        self.axes = np.stack((x, y, z))
        self.origin = pivot
        self.points = points
        self.local = (points - pivot) @ self.axes.T
        self.a, self.b, self.tip, self.bridge, _ = (marks - pivot) @ self.axes.T

    def deform(self, c):
        v = self.local
        delta = np.zeros_like(v)
        bridge_weight = falloff(v - self.bridge, [c.width, 1.5*c.width, 22])
        delta[:, 2] -= c.bridge * bridge_weight

        d = v - self.tip
        # Keep tip operations local so they don't spill into the lower eyelids.
        tip_weight = falloff(d, [12, 13, 15])
        # Lift the shoulders of the tip while giving the apex zero displacement.
        shoulder = 1 - np.exp(-(d[:, 0] / 4.5) ** 2)
        delta[:, 2] += tip_weight * (c.projection + c.roundness * shoulder)

        angle = np.deg2rad(c.rotation) * tip_weight
        cosine, sine = np.cos(angle), np.sin(angle)
        # Positive values lift the tip, rotating about the center at the base.
        delta[:, 1] += (cosine - 1) * v[:, 1] + sine * v[:, 2]
        delta[:, 2] += -sine * v[:, 1] + (cosine - 1) * v[:, 2]

        delta[:, 0] += c.wing_a * falloff(v - self.a, [10, 11, 12])
        delta[:, 0] -= c.wing_b * falloff(v - self.b, [10, 11, 12])
        return self.points + delta @ self.axes
