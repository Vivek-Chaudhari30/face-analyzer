import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ProfileArt } from "../ProfileArt";
import { ThreeStage, addEnvironment, addStudioLights } from "./ThreeStage";

/**
 * Decorative marble bust ("Marble Bust 01" by Rico Cilliers, Poly Haven, CC0;
 * see public/models/NOTICE.md). It is a sculpture, not a likeness of anyone at
 * the clinic. Drag to turn it; it rotates slowly on its own.
 */
export default function SculptureStage({ spin = 0.25, startAngle = 0.5, className = "" }: { spin?: number; startAngle?: number; className?: string }) {
  return (
    <ThreeStage
      className={className}
      interactive
      fov={26}
      ariaLabel="Decorative 3D marble bust. Drag to rotate."
      fallback={<ProfileArt className="h-full w-full p-10 opacity-70" />}
      setup={async ({ renderer, scene, camera, host, reduced, ready, invalidate }) => {
        const disposeEnv = addEnvironment(scene, renderer, 0.9);
        const { key } = addStudioLights(scene, { shadow: true });

        const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/marble-bust/marble_bust_01_1k.gltf`);
        const bust = gltf.scene;
        const box = new THREE.Box3().setFromObject(bust);
        const size = box.getSize(new THREE.Vector3());
        const scale = 1.8 / Math.max(size.x, size.y, size.z);
        bust.scale.setScalar(scale);
        const fitted = new THREE.Box3().setFromObject(bust);
        const center = fitted.getCenter(new THREE.Vector3());
        bust.position.sub(center);
        bust.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
          }
        });
        const group = new THREE.Group();
        group.add(bust);
        group.rotation.y = startAngle;
        scene.add(group);

        const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.18 }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = new THREE.Box3().setFromObject(group).min.y - 0.001;
        floor.receiveShadow = true;
        scene.add(floor);
        key.target = group;

        camera.position.set(0, 0.25, 4.9);
        camera.lookAt(0, 0.05, 0);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 0.05, 0);
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.enableDamping = true;
        controls.minPolarAngle = controls.maxPolarAngle = Math.PI / 2 - 0.05; // horizontal turning only
        controls.autoRotate = !reduced;
        controls.autoRotateSpeed = spin * 4;
        controls.addEventListener("change", invalidate);
        controls.update();
        ready();
        host.style.cursor = "grab";
        return {
          update: () => controls.update(),
          dispose: () => {
            controls.dispose();
            disposeEnv();
          },
        };
      }}
    />
  );
}

