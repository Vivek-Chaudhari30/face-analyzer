# AUREL Aesthetics: clinic demo site

A fictional luxury rhinoplasty clinic website that shows how a real clinic could present our 3D profile technology. It is independent of `ios/`, `web/` and `shared/`, and runs with no backend and no iPhone.

Stack: React 19, TypeScript, Vite, Tailwind CSS 4, Motion for React, Lucide, Three.js (used only in the studio and hero).

## Run locally

Requires Node 22.18 or newer.

```powershell
cd clinic-demo
npm install
npm run dev          # http://localhost:5173
```

Other commands:

```powershell
npm run typecheck    # tsc --noEmit
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build
npm run verify:calc  # check the revenue calculator against the brief's formulas
```

## Pages

| Route | Page |
| --- | --- |
| `/` | Home |
| `/clinic` | Our Clinic |
| `/studio` | 3D Profile Studio (capture, visualize, explore) |
| `/for-clinics` | Business Impact: hypothetical revenue calculator |
| `/book` | Book a Consultation (local demo state only) |

## Honesty rules built into the demo

- The demo 3D model is a procedurally generated placeholder, labelled "not a scan" everywhere it appears. The real scan `shared/samples/face-mesh-1.json` is not used or copied.
- Surgeon profiles are fictional and labelled "Illustrative profile". No testimonials or results are shown.
- The booking form sends nothing. Requests are saved in this browser's localStorage and the UI says so.
- The calculator is labelled "Hypothetical Impact Calculator". Revenue is gross, not profit. The 25% default uplift is an assumption, not a result.
- Mesh files are read in the browser. Nothing is uploaded.

## Integrating the real scanner and deformation code

Everything the studio needs from outside is in `src/adapters/`.

| File | Role |
| --- | --- |
| `types.ts` | `FaceMeshExport` (mirrors `docs/DATA_CONTRACT.md` and the JSON schema) plus the adapter interfaces |
| `validateMesh.ts` | Importer validation rules from the data contract |
| `index.ts` | **`defaultAdapters`: the single place to swap implementations** |
| `mock/mockLoader.ts` | Contract-JSON file import (real) and the demo model loader (placeholder) |
| `mock/mockDeformer.ts` | Placeholder deformation, works only on the demo model |
| `mock/demoMesh.ts` | Procedural demo mesh, topology `"sample"` |
| `jsonExporter.ts` | Downloads the (edited) mesh as contract JSON |

The three interfaces:

```ts
interface MeshLoaderAdapter {
  loadDemo(): Promise<MeshLoadResult | null>;
  loadFile(file: File): Promise<MeshLoadResult>;   // throw MeshLoadError on bad input
}
interface DeformationAdapter {
  canDeform(mesh): boolean;                         // false disables the sliders
  apply(base, params: { bridge, width, tip }): FaceMeshExport; // must not mutate base
  reset(base): FaceMeshExport;
}
interface MeshExportAdapter {
  export(mesh, source): { fileName; mimeType; data };
}
```

Slider values are normalised intensities in `-1 … +1`. The real code decides what they mean in meters, and should move vertices by index as the contract requires.

To integrate:

1. Implement `DeformationAdapter` using the teammates' nose-editing code (for example by wrapping functions from `web/`), and set `isDemo: false`.
2. Implement or extend `MeshLoaderAdapter` (a phone endpoint, URL, or file) and return `FaceMeshExport` objects.
3. Replace the entries in `defaultAdapters`, or pass `<FaceStudio adapters={...} />` from `src/pages/Studio.tsx`.
4. The demo banners disappear automatically when `isDemo` is false on both adapters.

The viewer (`features/face-studio/MeshViewer.tsx`) takes a `FaceMeshExport` and knows nothing about scanning or deformation. It can be reused directly.

## Structure

```
clinic-demo/
  src/
    adapters/            integration layer (see above)
    components/          header, footer, buttons, shared UI
    features/
      face-studio/       studio UI, state hook, Three.js viewer
      revenue-calculator/ pure maths (calc.ts), inputs, funnel, charts
    pages/               one file per route
    data/  hooks/  styles/
  scripts/verify-calc.mjs
```
