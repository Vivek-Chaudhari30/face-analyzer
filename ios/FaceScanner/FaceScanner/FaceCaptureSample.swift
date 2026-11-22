import Foundation
import simd

struct FaceCaptureSample: Equatable, Sendable {
    var isTracked: Bool
    var trackingNormal: Bool
    var trackingDetail: String
    var blendShapes: [String: Float]
    var vertices: [SIMD3<Float>]
    var indices: [Int]
    var textureCoordinates: [SIMD2<Float>]
    var facingDot: Float?
    var time: TimeInterval

    var gateSample: GateSample {
        GateSample(
            isTracked: isTracked,
            trackingNormal: trackingNormal,
            trackingDetail: trackingDetail,
            blendShapes: blendShapes,
            vertices: vertices,
            facingDot: facingDot,
            time: time
        )
    }
}
