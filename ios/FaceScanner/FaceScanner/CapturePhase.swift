import Foundation

enum CapturePhase: Equatable {
    case unsupported
    case needsPermission
    case permissionDenied
    case searching(detail: String)
    case ready
    case captured
    case failed(message: String)

    var title: String {
        switch self {
        case .unsupported:
            return "This device can't scan a face"
        case .needsPermission:
            return "Camera access"
        case .permissionDenied:
            return "Camera access is off"
        case .searching:
            return "Looking for a face"
        case .ready:
            return "Ready to capture"
        case .captured:
            return "Mesh captured"
        case .failed:
            return "Couldn't capture"
        }
    }

    var detail: String {
        switch self {
        case .unsupported:
            return "Face Analyzer needs a TrueDepth iPhone. The Simulator and phones without Face ID do not provide ARKit face tracking."
        case .needsPermission:
            return "The scan uses the front camera to fit a 3D face mesh. The mesh stays on this phone until you share it."
        case .permissionDenied:
            return "Allow camera access for Face Analyzer in Settings, then come back."
        case .searching(let detail):
            return detail
        case .ready:
            return "One face is tracked and holding still."
        case .captured:
            return "Share face-mesh.json, or capture again."
        case .failed(let message):
            return message
        }
    }

    var showsCamera: Bool {
        switch self {
        case .searching, .ready, .captured, .failed:
            return true
        case .unsupported, .needsPermission, .permissionDenied:
            return false
        }
    }
}
