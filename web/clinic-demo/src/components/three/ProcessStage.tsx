import { useEffect, useRef } from "react";
import * as THREE from "three";
import { loadDemoFace } from "../../adapters/loaders";
import { applyEdits } from "../../features/face-studio/edit/deform";
import { zeroValues } from "../../features/face-studio/edit/controls";
import { ProfileArt } from "../ProfileArt";
import { ThreeStage, addEnvironment, addStudioLights } from "./ThreeStage";
import { createFaceMesh, ivoryMaterial, updateFaceMesh } from "./faceMeshObject";

/**
 * One rotating sample face that changes presentation with the active step:
 * 0 Scan (points + sweeping scan line), 1 Explore (mesh), 2 Customize (live
 * edits from the real edit engine), 3 Consult (finished solid).
 */
export default function ProcessStage({ step, className = "" }: { step: number; className?: string }) {
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  return (
    <ThreeStage
      className={className}
      fov={24}
      ariaLabel="Animated sample 3D face illustrating the four steps: scan, explore, customize, consult."
      fallback={<ProfileArt className="h-full w-full p-10 opacity-70" />}
      setup={async ({ renderer, scene, camera, reduced, ready, invalidate }) => {
        const disposeEnv = addEnvironment(scene, renderer, 0.7);
        addStudioLights(scene);
        const { mesh: base } = await loadDemoFace();

        const solid = createFaceMesh(base, ivoryMaterial());
        const wire = new THREE.LineSegments(new THREE.WireframeGeometry(solid.geometry), new THREE.LineBasicMaterial({ color: 0xb08d57, transparent: true, opacity: 0.55 }));
        const pointPositions = (solid.geometry.getAttribute("position") as THREE.BufferAttribute).clone();
        const points = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", pointPositions), new THREE.PointsMaterial({ color: 0xc9a66b, size: 0.0032, transparent: true, opacity: 0.95 }));
        const scanLine = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.0012), new THREE.MeshBasicMaterial({ color: 0xc9a66b, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
        const group = new THREE.Group();
        group.add(solid, wire, points, scanLine);
        group.position.y = -0.005;
        scene.add(group);

        camera.position.set(0, 0.01, 0.62);
        camera.lookAt(0, 0.01, 0);
        ready();

        let lastEdit = -1;
        let currentStep = -1;
        const apply = (s: number) => {
          currentStep = s;
          solid.visible = s !== 0;
          wire.visible = s === 1;
          points.visible = s === 0;
          scanLine.visible = s === 0;
          (solid.material as THREE.MeshStandardMaterial).transparent = false;
          if (s !== 2) updateFaceMesh(solid, base);
        };
        apply(stepRef.current);
        invalidate();

        return {
          update: (t) => {
            const s = stepRef.current;
            if (s !== currentStep) apply(s);
            group.rotation.y = reduced ? 0.25 : Math.sin(t * 0.4) * 0.5;
            if (s === 0) {
              const y = -0.095 + ((reduced ? 0.5 : (t * 0.35) % 1) * 0.19);
              scanLine.position.set(0, y, 0.06);
              scanLine.scale.x = 1.1;
            }
            if (s === 2 && !reduced) {
              const m = (Math.sin(t * 1.1) + 1) / 2;
              if (Math.abs(m - lastEdit) > 0.01) {
                lastEdit = m;
                const v = zeroValues();
                v.noseBridge = -2 * m;
                v.tipRotation = 7 * m;
                v.chinProjection = 3 * m;
                v.upperLip = 1.8 * m;
                updateFaceMesh(solid, applyEdits(base, v));
              }
            }
            if (s === 2 && reduced) {
              const v = zeroValues();
              v.noseBridge = -2;
              v.tipRotation = 7;
              updateFaceMesh(solid, applyEdits(base, v));
            }
          },
          dispose: disposeEnv,
        };
      }}
    />
  );
}
