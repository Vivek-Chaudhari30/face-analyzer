# iOS face scanner

Owner: the iPhone app author. The web contributor does not edit this folder.

This app captures one face with ARKit and writes a JSON file that matches `docs/DATA_CONTRACT.md`. The Xcode project will live in `ios/FaceScanner/` when it is added. Until then, this folder only documents the boundary.

## Rules

- Stay inside `ios/` for app work.
- Export JSON with the field names in the data contract. Do not invent a second format for the website.
- A real export sets `"topology": "ARFaceGeometry"`.
- Do not commit `DerivedData/`, `xcuserdata/`, `*.xcuserstate`, or build products. Those are already in the root `.gitignore`.
- Do not edit `web/`.

## Needs

- Mac with Xcode
- A physical iPhone with Face ID
- A free Apple ID to install the prototype on that phone

## Handoff

Put a captured file anywhere the website can read it, or replace the discussion sample by opening a contract pull request. Day to day, drop exports outside git (AirDrop, a shared drive, or a local file). Do not commit personal face scans.
