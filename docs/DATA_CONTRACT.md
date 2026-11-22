# Face mesh data contract

This file is the only interface between the iPhone app and the website. If the JSON shape changes, update this document, `shared/schema/face-mesh.schema.json`, and `shared/samples/face-mesh.sample.json` in the same pull request. Do not change the shape from only `ios/` or only `web/`.

The website must be able to render `shared/samples/face-mesh.sample.json` with no iPhone connected. Real scans replace that sample. They use the same field names.

## File

One scan is one JSON file, UTF-8.

| Field | Required | Meaning |
| --- | --- | --- |
| `vertices` | yes | Array of `[x, y, z]` numbers. Units are meters. |
| `indices` | yes | Triangle list. Each group of three integers is one triangle. Values are indexes into `vertices`. |
| `textureCoordinates` | no | Array of `[u, v]` in `0...1`, one pair per vertex, same order as `vertices`. |
| `blendShapes` | no | Object of expression name to a number, usually `0...1`. |
| `units` | yes | Always `"meters"`. |
| `coordinateSystem` | yes | Always `"ARKit face-local"`. |
| `topology` | yes | `"ARFaceGeometry"` for a real ARKit export. `"sample"` for the checked-in sample. |
| `vertexCount` | yes | Must equal `vertices.length`. |
| `triangleCount` | yes | Must equal `indices.length / 3`. |

## Coordinates

ARKit face-local space:

- Origin is the center of the head.
- `+x` points toward the right side of the face (the person's right).
- `+y` points up.
- `+z` points out of the face, toward the camera.
- Distances are meters. `0.01` is 1 centimeter.

A real `ARFaceAnchor.geometry` export keeps the same vertex count and the same triangle indexes across people. Index `40` on one face is the same mesh point as index `40` on another face. Nose edits on the website must move vertices by index, not by searching for nearby points.

The checked-in sample is a four-vertex stand-in so the website can be built before a phone export exists. Its `topology` is `"sample"`. Do not treat it as a face, and do not assume a real scan has four vertices.

## Example

```json
{
  "vertices": [[0.0, 0.0, 0.0], [0.01, 0.0, 0.0], [0.0, 0.01, 0.0]],
  "indices": [0, 1, 2],
  "units": "meters",
  "coordinateSystem": "ARKit face-local",
  "topology": "sample",
  "vertexCount": 3,
  "triangleCount": 1
}
```

## What this data is

This is the ARKit front-face mesh for a promo visualization: rotate the face and move nose vertices. It is not a full-head scan and it is not a clinical rhinoplasty measurement.
