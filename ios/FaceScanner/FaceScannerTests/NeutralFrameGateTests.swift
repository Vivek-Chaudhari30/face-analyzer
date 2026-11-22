import simd
import XCTest
@testable import FaceScanner

final class NeutralFrameGateTests: XCTestCase {
    func testFaceBecomesReadyAfterHoldingStill() {
        var gate = NeutralFrameGate()
        let mesh = triangle()
        XCTAssertEqual(gate.evaluate(sample(vertices: mesh, time: 0)), .holding("Hold still"))
        XCTAssertEqual(gate.evaluate(sample(vertices: mesh, time: 0.2)), .holding("Hold still"))
        XCTAssertEqual(gate.evaluate(sample(vertices: mesh, time: 0.5)), .ready)
    }

    func testMotionRestartsTheHold() {
        var gate = NeutralFrameGate()
        let mesh = triangle()
        _ = gate.evaluate(sample(vertices: mesh, time: 0))
        XCTAssertEqual(gate.evaluate(sample(vertices: mesh, time: 0.5)), .ready)
        var moved = mesh
        moved[0].z += 0.005
        XCTAssertEqual(gate.evaluate(sample(vertices: moved, time: 0.6)), .holding("Hold still"))
    }

    func testOpenJawBlocksCapture() {
        var gate = NeutralFrameGate()
        let decision = gate.evaluate(sample(vertices: triangle(), time: 0, jawOpen: 0.4))
        XCTAssertEqual(decision, .blocked("Close your mouth a little"))
    }

    func testLookAwayBlocksCapture() {
        var gate = NeutralFrameGate()
        let decision = gate.evaluate(sample(vertices: triangle(), time: 0, facingDot: 0))
        XCTAssertEqual(decision, .blocked("Look at the phone"))
    }

    func testLostTrackingResetsTheHold() {
        var gate = NeutralFrameGate()
        let mesh = triangle()
        _ = gate.evaluate(sample(vertices: mesh, time: 0))
        XCTAssertEqual(
            gate.evaluate(sample(vertices: mesh, time: 0.2, tracked: false)),
            .blocked("Looking for a face")
        )
        XCTAssertEqual(gate.evaluate(sample(vertices: mesh, time: 0.3)), .holding("Hold still"))
    }

    func testFacingDotIsPositiveWhenTheFacePointsAtTheCamera() {
        let face = matrix_identity_float4x4
        var camera = matrix_identity_float4x4
        camera.columns.3 = SIMD4(0, 0, 0.4, 1)
        let dot = NeutralFrameGate.facingDot(faceTransform: face, cameraTransform: camera)
        XCTAssertEqual(dot, 1, accuracy: 0.0001)
    }

    private func triangle() -> [SIMD3<Float>] {
        [SIMD3(0, 0, 0.04), SIMD3(0.02, 0, 0.04), SIMD3(0, 0.02, 0.04)]
    }

    private func sample(
        vertices: [SIMD3<Float>],
        time: TimeInterval,
        tracked: Bool = true,
        jawOpen: Float = 0,
        facingDot: Float? = 1
    ) -> GateSample {
        GateSample(
            isTracked: tracked,
            trackingNormal: true,
            trackingDetail: "Looking for a face",
            blendShapes: [BlendShapeKey.jawOpen: jawOpen],
            vertices: vertices,
            facingDot: facingDot,
            time: time
        )
    }
}
