import ARKit
import XCTest
@testable import FaceScanner

@MainActor
final class CaptureControllerTests: XCTestCase {
    func testUnsupportedDeviceStaysUnsupported() {
        let controller = CaptureController(faceTrackingSupported: false)
        controller.onAppear()
        XCTAssertEqual(controller.phase, .unsupported)
        XCTAssertFalse(controller.phase.showsCamera)
        XCTAssertNil(controller.document)
    }

    func testSimulatorReportsFaceTrackingUnsupported() {
        #if targetEnvironment(simulator)
        XCTAssertFalse(ARFaceTrackingConfiguration.isSupported)
        #endif
    }

    func testBlendShapeNamesMatchARKit() {
        XCTAssertEqual(BlendShapeKey.jawOpen, ARFaceAnchor.BlendShapeLocation.jawOpen.rawValue)
        XCTAssertEqual(BlendShapeKey.mouthSmileLeft, ARFaceAnchor.BlendShapeLocation.mouthSmileLeft.rawValue)
        XCTAssertEqual(BlendShapeKey.mouthSmileRight, ARFaceAnchor.BlendShapeLocation.mouthSmileRight.rawValue)
        XCTAssertEqual(BlendShapeKey.mouthFunnel, ARFaceAnchor.BlendShapeLocation.mouthFunnel.rawValue)
        XCTAssertEqual(BlendShapeKey.mouthPucker, ARFaceAnchor.BlendShapeLocation.mouthPucker.rawValue)
        XCTAssertEqual(BlendShapeKey.browInnerUp, ARFaceAnchor.BlendShapeLocation.browInnerUp.rawValue)
        XCTAssertEqual(BlendShapeKey.eyeBlinkLeft, ARFaceAnchor.BlendShapeLocation.eyeBlinkLeft.rawValue)
        XCTAssertEqual(BlendShapeKey.eyeBlinkRight, ARFaceAnchor.BlendShapeLocation.eyeBlinkRight.rawValue)
        XCTAssertEqual(BlendShapeKey.jawOpen, "jawOpen")
        XCTAssertEqual(BlendShapeKey.mouthSmileLeft, "mouthSmile_L")
        XCTAssertEqual(BlendShapeKey.mouthSmileRight, "mouthSmile_R")
        XCTAssertEqual(BlendShapeKey.eyeBlinkLeft, "eyeBlink_L")
        XCTAssertEqual(BlendShapeKey.eyeBlinkRight, "eyeBlink_R")
    }

    func testCaptureWritesCountsAndCaptureAgainClearsTheMesh() throws {
        let controller = CaptureController(faceTrackingSupported: true)
        controller.enterTracking()
        let mesh = stableTriangle()
        controller.ingest(mesh(0))
        controller.ingest(mesh(0.5))
        XCTAssertEqual(controller.phase, .ready)

        controller.capture()
        XCTAssertEqual(controller.phase, .captured)
        XCTAssertEqual(controller.document?.vertexCount, 3)
        XCTAssertEqual(controller.document?.triangleCount, 1)
        XCTAssertEqual(controller.document?.vertices.first?.first, Double(Float(0.25)))
        XCTAssertEqual(controller.document?.indices, [0, 2, 1])

        controller.captureAgain()
        XCTAssertNil(controller.document)
        guard case .searching = controller.phase else {
            return XCTFail("Expected searching, got \(controller.phase)")
        }
    }

    func testCaptureRejectsAnIndexOutsideTheVertexList() {
        let controller = CaptureController(faceTrackingSupported: true)
        controller.enterTracking()
        let mesh = stableTriangle(indices: [0, 1, 9])
        controller.ingest(mesh(0))
        controller.ingest(mesh(0.5))
        controller.capture()
        guard case .failed = controller.phase else {
            return XCTFail("Expected failure, got \(controller.phase)")
        }
        XCTAssertNil(controller.document)
    }

    private func stableTriangle(indices: [Int] = [0, 2, 1]) -> (TimeInterval) -> FaceCaptureSample {
        let vertices = [
            SIMD3<Float>(0.25, 0, 0.5),
            SIMD3<Float>(-0.25, 0, 0.5),
            SIMD3<Float>(0, 0.25, 0.5),
        ]
        return { time in
            FaceCaptureSample(
                isTracked: true,
                trackingNormal: true,
                trackingDetail: "Looking for a face",
                blendShapes: [:],
                vertices: vertices,
                indices: indices,
                textureCoordinates: [SIMD2(0, 0), SIMD2(1, 0), SIMD2(0.5, 1)],
                facingDot: 1,
                time: time
            )
        }
    }
}
