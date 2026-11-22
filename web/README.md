# Website

Owner: the web contributor. The iPhone app author does not edit this folder.

This site loads the face-mesh JSON and draws it with Three.js: orbit the face, then move nose vertices. Build against `shared/samples/face-mesh.sample.json` so this work does not wait on a phone.

## Rules

- Stay inside `web/` for site work.
- Read vertices as meters in ARKit face-local space. See `docs/DATA_CONTRACT.md`.
- The sample has `"topology": "sample"` and four vertices. A phone file has `"topology": "ARFaceGeometry"` and the real ARKit vertex list. Same field names either way.
- Identify facial points by vertex index. Those indexes are stable on real ARKit exports.
- Do not commit `node_modules/`, `dist/`, or `.env`.
- Do not edit `ios/`.
- Do not commit a real person's face scan into this repo.

## App code

When the site is added, keep it in `web/` (for example `web/package.json` and `web/src/`). Do not place a second frontend at the repository root. Root files are only `README.md`, `.gitignore`, `docs/`, and `shared/`.
