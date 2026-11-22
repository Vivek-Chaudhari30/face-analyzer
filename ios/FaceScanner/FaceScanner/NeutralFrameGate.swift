import ARKit
import Foundation
import simd

enum BlendShapeKey {
    static let jawOpen = ARFaceAnchor.BlendShapeLocation.jawOpen.rawValue
    static let mouthSmileLeft = ARFaceAnchor.BlendShapeLocation.mouthSmileLeft.rawValue
    static let mouthSmileRight = ARFaceAnchor.BlendShapeLocation.mouthSmileRight.rawValue
    static let mouthFunnel = ARFaceAnchor.BlendShapeLocation.mouthFunnel.rawValue
    static let mouthPucker = ARFaceAnchor.BlendShapeLocation.mouthPucker.rawValue
    static let browInnerUp = ARFaceAnchor.BlendShapeLocation.browInnerUp.rawValue
    static let eyeBlinkLeft = ARFaceAnchor.BlendShapeLocation.eyeBlinkLeft.rawValue
    static let eyeBlinkRight = ARFaceAnchor.BlendShapeLocation.eyeBlinkRight.rawValue
}

struct GateSample: Equatable {
    var isTracked: Bool
    var trackingNormal: Bool
    var trackingDetail: String
    var blendShapes: [String: Float]
    var vertices: [SIMD3<Float>]
    var facingDot: Float?
    var time: TimeInterval
}

enum GateDecision: Equatable {
    case blocked(String)
    case holding(String)
    case ready
}

/// Enables Capture after one tracked face stays neutral and still.
/// The numeric thresholds are starting values for the first phone session.
struct NeutralFrameGate {
    struct Thresholds: Equatable {
        var jawOpen: Float = 0.08
        var mouthSmile: Float = 0.15
        var mouthFunnel: Float = 0.12
        var mouthPucker: Float = 0.12
        var browInnerUp: Float = 0.20
        var eyeBlink: Float = 0.40
        /// Largest vertex motion allowed during the hold, in meters.
        var maxVertexDelta: Float = 0.0015
        var holdSeconds: TimeInterval = 0.40
        /// Dot product of the face forward axis and the direction toward the camera.
        var minimumFacingDot: Float = 0.65
    }

    var thresholds = Thresholds()
    private var referenceVertices: [SIMD3<Float>]?
    private var holdStartedAt: TimeInterval?

    mutating func reset() {
        referenceVertices = nil
        holdStartedAt = nil
    }

    mutating func evaluate(_ sample: GateSample) -> GateDecision {
        guard sample.trackingNormal else {
            reset()
            return .blocked(sample.trackingDetail)
        }
        guard sample.isTracked else {
            reset()
            return .blocked("Looking for a face")
        }
        if let facingDot = sample.facingDot, facingDot < thresholds.minimumFacingDot {
            reset()
            return .blocked("Look at the phone")
        }
        if let expression = expressionProblem(sample.blendShapes) {
            reset()
            return .blocked(expression)
        }
        guard sample.vertices.count >= 3 else {
            reset()
            return .blocked("Face mesh is incomplete")
        }

        guard let reference = referenceVertices, reference.count == sample.vertices.count else {
            referenceVertices = sample.vertices
            holdStartedAt = sample.time
            return .holding("Hold still")
        }

        let maxDelta = zip(reference, sample.vertices).reduce(Float(0)) { partial, pair in
            max(partial, simd_distance(pair.0, pair.1))
        }
        guard maxDelta <= thresholds.maxVertexDelta else {
            referenceVertices = sample.vertices
            holdStartedAt = sample.time
            return .holding("Hold still")
        }

        let started = holdStartedAt ?? sample.time
        holdStartedAt = started
        if sample.time - started >= thresholds.holdSeconds {
            return .ready
        }
        return .holding("Hold still")
    }

    private func expressionProblem(_ blendShapes: [String: Float]) -> String? {
        func value(_ key: String) -> Float {
            blendShapes[key] ?? 0
        }
        if value(BlendShapeKey.jawOpen) > thresholds.jawOpen {
            return "Close your mouth a little"
        }
        if value(BlendShapeKey.mouthSmileLeft) > thresholds.mouthSmile
            || value(BlendShapeKey.mouthSmileRight) > thresholds.mouthSmile {
            return "Relax your smile"
        }
        if value(BlendShapeKey.mouthFunnel) > thresholds.mouthFunnel
            || value(BlendShapeKey.mouthPucker) > thresholds.mouthPucker {
            return "Relax your lips"
        }
        if value(BlendShapeKey.browInnerUp) > thresholds.browInnerUp {
            return "Relax your eyebrows"
        }
        if value(BlendShapeKey.eyeBlinkLeft) > thresholds.eyeBlink
            && value(BlendShapeKey.eyeBlinkRight) > thresholds.eyeBlink {
            return "Open your eyes"
        }
        return nil
    }

    static func facingDot(faceTransform: simd_float4x4, cameraTransform: simd_float4x4) -> Float {
        let facePosition = SIMD3<Float>(
            faceTransform.columns.3.x,
            faceTransform.columns.3.y,
            faceTransform.columns.3.z
        )
        let faceForward = SIMD3<Float>(
            faceTransform.columns.2.x,
            faceTransform.columns.2.y,
            faceTransform.columns.2.z
        )
        let cameraPosition = SIMD3<Float>(
            cameraTransform.columns.3.x,
            cameraTransform.columns.3.y,
            cameraTransform.columns.3.z
        )
        let towardCamera = cameraPosition - facePosition
        let towardLength = simd_length(towardCamera)
        let forwardLength = simd_length(faceForward)
        guard towardLength > 0.0001, forwardLength > 0.0001 else { return 0 }
        return simd_dot(faceForward / forwardLength, towardCamera / towardLength)
    }
}
