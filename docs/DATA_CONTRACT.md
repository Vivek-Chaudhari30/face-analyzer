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
| `topology` | yes | `"ARFaceGeometry"` for a real ARKit export. `"MediaPipeFaceMesh"` for a webcam capture from the website. `"sample"` for the checked-in sample. |
| `vertexCount` | yes | Must equal `vertices.length`. |
| `triangleCount` | yes | Must equal `indices.length / 3`. |

## Coordinates

ARKit face-local space is right-handed. Distances are meters. `0.01` is 1 centimeter.

- The origin is centered behind the face.
- `+x` points to the viewer's right, which is the person's left.
- `+y` points up, relative to the face.
- `+z` points out of the face, toward the viewer.

The iPhone exporter copies `ARFaceAnchor.geometry` vertices, texture coordinates, and triangle indexes in that orientation and order. It does not flip an axis to match the mirrored camera preview. In the mirrored preview the person's right eye appears on the right side of the screen. In the exported mesh, the person's left side is on the viewer's right.

A real `ARFaceAnchor.geometry` export keeps the same vertex count and the same triangle indexes across people. Index `40` on one face is the same mesh point as index `40` on another face. That index is an example of stable topology, not a nose landmark. Nose edits on the website must move vertices by index, not by searching for nearby points.

`shared/samples/face-mesh.sample.json` is a four-vertex stand-in so the website can be built before a phone export exists. Its `topology` is `"sample"`. Do not treat it as a face, and do not assume every file has four vertices.

`shared/samples/face-mesh-1.json` is the first real export from a TrueDepth iPhone. Its `topology` is `"ARFaceGeometry"`, with 1,220 vertices and 2,304 triangles. Those counts are the topology measured on that phone. Later personal scans stay out of git.

## Webcam captures

The website can also capture a face with an ordinary laptop or phone camera, using MediaPipe Face Landmarker in the browser. Those files set `"topology": "MediaPipeFaceMesh"`.

- 468 vertices and 852 triangles, in the same order on every capture. Index `1` on one webcam capture is the same mesh point on another. Webcam and ARKit indexes do not match each other.
- The axes are the same as an ARKit export: `+x` to the viewer's right (the person's left), `+y` up, `+z` out of the face. `coordinateSystem` stays `"ARKit face-local"` to name that convention.
- A webcam has no depth sensor. MediaPipe estimates depth from the picture, so the profile is smoother and less exact than a TrueDepth scan.
- A camera cannot measure size. The website scales each capture so the outer eye corners (indexes `33` and `263`) are 90 mm apart, a typical adult value, and puts the frontmost point 65 mm in front of the origin.
- `vertexColors` are sampled from the same camera frame. `blendShapes` use the ARKit expression names that MediaPipe reports. There are no `textureCoordinates`.

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

## Validation

`shared/schema/face-mesh.schema.json` checks field names, types, the fixed `units` and `coordinateSystem` strings, and that `topology` is `ARFaceGeometry`, `MediaPipeFaceMesh` or `sample`. It does not compare one field with another.

The exporter, and any importer, must also reject a file when:

- a vertex, texture coordinate, or blend shape value is not finite
- `vertexCount` is not `vertices.length`
- `indices.length` is not divisible by 3
- `triangleCount` is not `indices.length / 3`
- an index is outside `0..<vertices.length`
- `textureCoordinates` is present and its length is not `vertices.length`

## What this data is

This is the ARKit front-face mesh for a promo visualization: rotate the face and move nose vertices. It is not a full-head scan and it is not a clinical rhinoplasty measurement.
