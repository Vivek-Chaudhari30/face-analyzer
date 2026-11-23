import * as THREE from "three";
import { loadDemoFace } from "../../adapters/loaders";
import { applyEdits } from "../../features/face-studio/edit/deform";
import { zeroValues } from "../../features/face-studio/edit/controls";
import { ProfileArt } from "../ProfileArt";
import { ThreeStage, addEnvironment, addStudioLights } from "./ThreeStage";
import { createFaceMesh, ivoryMaterial, updateFaceMesh } from "./faceMeshObject";

/**
 * Two faces turned toward each other. The left is the sample face as-is; the
 * right eases between the same face and a gently adjusted copy, using the real
 * edit engine. Both are generic sample data, not anyone's scan.
 */
export default function FacePairStage({ className = "" }: { className?: string }) {
  return (
    <ThreeStage
      className={className}
      fov={24}
      ariaLabel="Two sample 3D faces facing each other. The right face gently changes shape. Decorative."
      fallback={<ProfileArt className="h-full w-full p-10 opacity-70" />}
      setup={async ({ renderer, scene, camera, reduced, ready, invalidate }) => {
        const disposeEnv = addEnvironment(scene, renderer, 0.7);
        addStudioLights(scene);
        const { mesh: base } = await loadDemoFace();

        const left = createFaceMesh(base, ivoryMaterial());
        const right = createFaceMesh(base, ivoryMaterial({ color: 0xe9d6b6 }));
        const turn = THREE.MathUtils.degToRad(68);
        const gap = 0.205;
        const lg = new THREE.Group();
        const rg = new THREE.Group();
        lg.add(left);
        rg.add(right);
        lg.position.set(-gap, 0, 0);
        rg.position.set(gap, 0, 0);
        lg.rotation.y = turn; // nose toward +x
        rg.rotation.y = -turn; // nose toward -x
        scene.add(lg, rg);

        // A soft gold glint behind the refined face.
        const halo = new THREE.Mesh(new THREE.CircleGeometry(0.19, 64), new THREE.MeshBasicMaterial({ color: 0xc9a66b, transparent: true, opacity: 0.16 }));
        halo.position.set(gap + 0.02, 0, -0.14);
        scene.add(halo);

        camera.position.set(0, 0.012, 1.15);
        camera.lookAt(0, 0.012, 0);

        // Subtle, bounded edits for the animated "refined" face.
        const target = zeroValues();
        target.noseBridge = -1.6;
        target.tipRotation = 5;
        target.chinProjection = 2.2;
        target.upperLip = 1.2;
        let lastMix = -1;

        ready();
        if (reduced) {
          updateFaceMesh(right, applyEdits(base, { ...target }));
          invalidate();
        }
        return {
          update: (t) => {
            const sway = reduced ? 0 : Math.sin(t * 0.5) * 0.06;
            lg.rotation.y = turn + sway;
            rg.rotation.y = -turn - sway;
            lg.position.y = rg.position.y = reduced ? 0 : Math.sin(t * 0.7) * 0.004;
            halo.material.opacity = 0.12 + (reduced ? 0.04 : Math.sin(t * 0.8) * 0.04 + 0.04);
            if (reduced) return;
            const mix = (Math.sin(t * 0.55 - 1.2) + 1) / 2; // 0..1, eases between original and refined
            if (Math.abs(mix - lastMix) > 0.004) {
              lastMix = mix;
              const v = zeroValues();
              for (const k of Object.keys(target) as (keyof typeof target)[]) v[k] = target[k] * mix;
              updateFaceMesh(right, applyEdits(base, v));
            }
          },
          dispose: disposeEnv,
        };
      }}
    />
  );
}
