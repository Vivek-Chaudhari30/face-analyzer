import Foundation
import simd

/// JSON document described by `docs/DATA_CONTRACT.md`.
struct FaceMeshDocument: Codable, Equatable {
    var vertices: [[Double]]
    var indices: [Int]
    var textureCoordinates: [[Double]]?
    var blendShapes: [String: Double]?
    var units: String
    var coordinateSystem: String
    var topology: String
    var vertexCount: Int
    var triangleCount: Int

    /// Copies ARKit buffers in their original order. Positive X stays positive X.
    static func captured(
        vertices: [SIMD3<Float>],
        indices: [Int],
        textureCoordinates: [SIMD2<Float>],
        blendShapes: [String: Float]
    ) -> FaceMeshDocument {
        let coordinates = textureCoordinates.count == vertices.count
            ? textureCoordinates.map { [Double($0.x), Double($0.y)] }
            : nil
        return FaceMeshDocument(
            vertices: vertices.map { [Double($0.x), Double($0.y), Double($0.z)] },
            indices: indices,
            textureCoordinates: coordinates,
            blendShapes: blendShapes.mapValues(Double.init),
            units: "meters",
            coordinateSystem: "ARKit face-local",
            topology: "ARFaceGeometry",
            vertexCount: vertices.count,
            triangleCount: indices.count / 3
        )
    }

    func validate() throws {
        guard units == "meters" else { throw FaceMeshValidationError.invalidUnits }
        guard coordinateSystem == "ARKit face-local" else {
            throw FaceMeshValidationError.invalidCoordinateSystem
        }
        guard topology == "ARFaceGeometry" || topology == "sample" else {
            throw FaceMeshValidationError.invalidTopology
        }
        guard vertices.count >= 3 else { throw FaceMeshValidationError.tooFewVertices }
        guard vertexCount == vertices.count else {
            throw FaceMeshValidationError.vertexCountMismatch(declared: vertexCount, actual: vertices.count)
        }
        guard indices.count >= 3, indices.count.isMultiple(of: 3) else {
            throw FaceMeshValidationError.indexCountNotMultipleOfThree(indices.count)
        }
        let actualTriangles = indices.count / 3
        guard triangleCount == actualTriangles else {
            throw FaceMeshValidationError.triangleCountMismatch(declared: triangleCount, actual: actualTriangles)
        }
        for (offset, vertex) in vertices.enumerated() {
            guard vertex.count == 3, vertex.allSatisfy(\.isFinite) else {
                throw FaceMeshValidationError.nonFiniteVertex(offset)
            }
        }
        for index in indices where index < 0 || index >= vertices.count {
            throw FaceMeshValidationError.indexOutOfBounds(index)
        }
        if let textureCoordinates {
            guard textureCoordinates.count == vertices.count else {
                throw FaceMeshValidationError.textureCoordinateCountMismatch(textureCoordinates.count)
            }
            for (offset, pair) in textureCoordinates.enumerated() {
                guard pair.count == 2, pair.allSatisfy(\.isFinite) else {
                    throw FaceMeshValidationError.nonFiniteTextureCoordinate(offset)
                }
            }
        }
        if let blendShapes {
            for (name, value) in blendShapes where !value.isFinite {
                throw FaceMeshValidationError.nonFiniteBlendShape(name)
            }
        }
    }
}

enum FaceMeshValidationError: LocalizedError, Equatable {
    case notAnObject
    case unknownFields([String])
    case invalidUnits
    case invalidCoordinateSystem
    case invalidTopology
    case tooFewVertices
    case vertexCountMismatch(declared: Int, actual: Int)
    case indexCountNotMultipleOfThree(Int)
    case triangleCountMismatch(declared: Int, actual: Int)
    case indexOutOfBounds(Int)
    case nonFiniteVertex(Int)
    case nonFiniteTextureCoordinate(Int)
    case textureCoordinateCountMismatch(Int)
    case nonFiniteBlendShape(String)

    var errorDescription: String? {
        switch self {
        case .notAnObject:
            return "The file is not a JSON object."
        case .unknownFields(let fields):
            return "The file has unknown fields: \(fields.joined(separator: ", "))."
        case .invalidUnits:
            return "units must be meters."
        case .invalidCoordinateSystem:
            return "coordinateSystem must be ARKit face-local."
        case .invalidTopology:
            return "topology must be ARFaceGeometry or sample."
        case .tooFewVertices:
            return "A mesh needs at least 3 vertices."
        case .vertexCountMismatch(let declared, let actual):
            return "vertexCount is \(declared), but vertices has \(actual) points."
        case .indexCountNotMultipleOfThree(let count):
            return "indices has \(count) values, which is not a list of triangles."
        case .triangleCountMismatch(let declared, let actual):
            return "triangleCount is \(declared), but indices describes \(actual) triangles."
        case .indexOutOfBounds(let index):
            return "Triangle index \(index) is outside the vertex list."
        case .nonFiniteVertex(let index):
            return "Vertex \(index) is not a finite xyz position."
        case .nonFiniteTextureCoordinate(let index):
            return "Texture coordinate \(index) is not a finite uv pair."
        case .textureCoordinateCountMismatch(let count):
            return "textureCoordinates has \(count) pairs, which does not match the vertex count."
        case .nonFiniteBlendShape(let name):
            return "Blend shape \(name) is not a finite number."
        }
    }
}

enum FaceMeshCodec {
    static let allowedKeys: Set<String> = [
        "vertices",
        "indices",
        "textureCoordinates",
        "blendShapes",
        "units",
        "coordinateSystem",
        "topology",
        "vertexCount",
        "triangleCount",
    ]

    static func encode(_ document: FaceMeshDocument) throws -> Data {
        try document.validate()
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(document)
    }

    static func decode(_ data: Data) throws -> FaceMeshDocument {
        let raw = try JSONSerialization.jsonObject(with: data)
        guard let object = raw as? [String: Any] else {
            throw FaceMeshValidationError.notAnObject
        }
        let unknown = Set(object.keys).subtracting(allowedKeys).sorted()
        guard unknown.isEmpty else {
            throw FaceMeshValidationError.unknownFields(unknown)
        }
        let document = try JSONDecoder().decode(FaceMeshDocument.self, from: data)
        try document.validate()
        return document
    }
}

enum FaceMeshFileWriter {
    static func write(
        _ document: FaceMeshDocument,
        directory: URL = FileManager.default.temporaryDirectory,
        createdAt: Date = Date()
    ) throws -> URL {
        let data = try FaceMeshCodec.encode(document)
        let folder = directory.appendingPathComponent("face-mesh-\(stamp(createdAt))", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let url = folder.appendingPathComponent("face-mesh.json")
        try data.write(to: url, options: .atomic)
        return url
    }

    static func stamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        return formatter.string(from: date)
    }
}
