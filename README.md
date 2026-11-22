# Face Analyzer

Two separate codebases in one repository.

| Path | Who | What |
| --- | --- | --- |
| `ios/` | iPhone app author | Swift + ARKit app. Captures a face and exports one JSON mesh. |
| `web/` | Web contributor | React + Three.js site. Loads that JSON, rotates the face, edits the nose. |
| `shared/` | Both, only by agreement | JSON Schema and a fake sample mesh. |
| `docs/DATA_CONTRACT.md` | Both, only by agreement | The field names and coordinate system both sides must follow. |

The iPhone app is part one. The website is part two. The web contributor does not open Xcode. The iPhone author does not build the site. They meet only at the JSON file described in `docs/DATA_CONTRACT.md`.

`shared/samples/face-mesh.sample.json` is a four-vertex stand-in. It is not a face. `shared/samples/face-mesh-1.json` is the first real phone export: 1,220 vertices, 2,304 triangles, topology `ARFaceGeometry`. Later personal scans stay out of git.

This mesh is for a promo visualization. It is not a medical measurement and it is not a clinical rhinoplasty plan.

## How to avoid GitHub clashes

Each person only commits inside their own folder.

1. `main` is the shared branch. Do not commit straight to `main`.
2. Update `main` before you start: `git checkout main` then `git pull`.
3. Branch from `main` with your area in the name: `ios/export-json` or `web/load-mesh`.
4. A pull request for app work may touch `ios/` only. A pull request for the site may touch `web/` only.
5. Do not reformat, rename, or clean up the other person's folder.
6. Generated files stay untracked: Xcode `DerivedData/` and `xcuserdata/`, and web `node_modules/` and `dist/`. See `.gitignore`.
7. Do not commit face scans, photos, or `.env` files.

`shared/` and `docs/DATA_CONTRACT.md` are the only files you can both need. Only one person edits them at a time, in a pull request that says the contract changed. The other person pulls `main` after that pull request merges, then continues. Do not both change the schema in parallel.

When GitHub usernames are both known, uncomment the paths in `.github/CODEOWNERS` so reviews are requested automatically.

## Day-to-day

iPhone author: work in `ios/`. Read `ios/README.md`. Export JSON that validates against `shared/schema/face-mesh.schema.json`.

Web contributor: work in `web/`. Read `web/README.md`. Load `shared/samples/face-mesh.sample.json` first. Later, load a real export with the same fields.

## Layout

```text
face-analyzer/
  README.md
  .gitignore
  .github/CODEOWNERS
  docs/DATA_CONTRACT.md
  ios/                  # iPhone app only
  web/                  # website only
  shared/schema/        # JSON Schema
  shared/samples/       # fake mesh for the website
```
