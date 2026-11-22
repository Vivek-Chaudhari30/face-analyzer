import XCTest
@testable import FaceScanner

final class FaceMeshDocumentTests: XCTestCase {
    func testRoundTripPreservesOrientationCountsAndIndexOrder() throws {
        let document = FaceMeshDocument.captured(
            vertices: [
                SIMD3(0.25, 0, 0.5),
                SIMD3(-0.25, 0, 0.5),
                SIMD3(0, 0.25, 0.5),
            ],
            indices: [0, 2, 1],
            textureCoordinates: [
                SIMD2(0, 0),
                SIMD2(1, 0),
                SIMD2(0.5, 1),
            ],
            blendShapes: [BlendShapeKey.jawOpen: 0.02]
        )

        let data = try FaceMeshCodec.encode(document)
        let decoded = try FaceMeshCodec.decode(data)

        XCTAssertEqual(decoded, document)
        XCTAssertEqual(decoded.vertices[0][0], Double(Float(0.25)))
        XCTAssertEqual(decoded.vertices[1][0], Double(Float(-0.25)))
        XCTAssertEqual(decoded.indices, [0, 2, 1])
        XCTAssertEqual(decoded.vertexCount, 3)
        XCTAssertEqual(decoded.triangleCount, 1)
        XCTAssertEqual(decoded.units, "meters")
        XCTAssertEqual(decoded.coordinateSystem, "ARKit face-local")
        XCTAssertEqual(decoded.topology, "ARFaceGeometry")
        XCTAssertEqual(decoded.textureCoordinates?.count, 3)
    }

    func testCheckedInSampleValidates() throws {
        let repoRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let sample = repoRoot.appendingPathComponent("shared/samples/face-mesh.sample.json")
        let document = try FaceMeshCodec.decode(Data(contentsOf: sample))
        XCTAssertEqual(document.topology, "sample")
        XCTAssertEqual(document.vertexCount, 4)
        XCTAssertEqual(document.triangleCount, 4)
        XCTAssertEqual(document.vertices.count, 4)
        XCTAssertEqual(document.indices.count, 12)
    }

    func testEncodeRejectsMismatchedVertexCount() {
        var document = validTriangle()
        document.vertexCount = 9
        XCTAssertThrowsError(try FaceMeshCodec.encode(document)) { error in
            guard case FaceMeshValidationError.vertexCountMismatch(9, 3) = error else {
                return XCTFail("Unexpected error: \(error)")
            }
        }
    }

    func testEncodeRejectsMismatchedTriangleCount() {
        var document = validTriangle()
        document.triangleCount = 4
        XCTAssertThrowsError(try document.validate()) { error in
            guard case FaceMeshValidationError.triangleCountMismatch(4, 1) = error else {
                return XCTFail("Unexpected error: \(error)")
            }
        }
    }

    func testEncodeRejectsIndicesThatAreNotTriangles() {
        var document = validTriangle()
        document.indices = [0, 1, 2, 1]
        document.triangleCount = 1
        XCTAssertThrowsError(try document.validate()) { error in
            guard case FaceMeshValidationError.indexCountNotMultipleOfThree(4) = error else {
                return XCTFail("Unexpected error: \(error)")
            }
        }
    }

    func testEncodeRejectsIndexOutOfBounds() {
        var document = validTriangle()
        document.indices = [0, 1, 9]
        XCTAssertThrowsError(try document.validate()) { error in
            guard case FaceMeshValidationError.indexOutOfBounds(9) = error else {
                return XCTFail("Unexpected error: \(error)")
            }
        }
    }

    func testEncodeRejectsNonFiniteVertex() {
        var document = validTriangle()
        document.vertices[0][2] = .infinity
        XCTAssertThrowsError(try document.validate()) { error in
            guard case FaceMeshValidationError.nonFiniteVertex(0) = error else {
                return XCTFail("Unexpected error: \(error)")
            }
        }
    }

    func testEncodeRejectsTextureCoordinateCountMismatch() {
        var document = validTriangle()
        document.textureCoordinates = [[0, 0]]
        XCTAssertThrowsError(try document.validate()) { error in
            guard case FaceMeshValidationError.textureCoordinateCountMismatch(1) = error else {
                return XCTFail("Unexpected error: \(error)")
            }
        }
    }

    func testWrittenFileRoundTripsOutsideTheRepository() throws {
        let document = validTriangle()
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("face-scanner-tests-\(UUID().uuidString)", isDirectory: true)
        let url = try FaceMeshFileWriter.write(document, directory: directory, createdAt: Date(timeIntervalSince1970: 0))
        XCTAssertEqual(url.lastPathComponent, "face-mesh.json")
        let decoded = try FaceMeshCodec.decode(Data(contentsOf: url))
        XCTAssertEqual(decoded, document)
        try FileManager.default.removeItem(at: directory)
    }

    private func validTriangle() -> FaceMeshDocument {
        FaceMeshDocument.captured(
            vertices: [SIMD3(0, 0, 0), SIMD3(0.01, 0, 0), SIMD3(0, 0.01, 0)],
            indices: [0, 1, 2],
            textureCoordinates: [SIMD2(0, 0), SIMD2(1, 0), SIMD2(0, 1)],
            blendShapes: [:]
        )
    }
}
