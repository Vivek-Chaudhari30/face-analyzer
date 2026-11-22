import ARKit
import AVFoundation
import SceneKit
import UIKit

@MainActor
final class CaptureController: NSObject, ObservableObject {
    @Published private(set) var phase: CapturePhase
    @Published private(set) var document: FaceMeshDocument?
    @Published private(set) var shareError: String?

    /// Read from the SceneKit callback. `ARSession.currentFrame` is safe to sample there.
    nonisolated(unsafe) let session = ARSession()

    private let faceTrackingSupported: Bool
    private var gate = NeutralFrameGate()
    private var latestSample: FaceCaptureSample?
    private var appeared = false

    init(faceTrackingSupported: Bool = ARFaceTrackingConfiguration.isSupported) {
        self.faceTrackingSupported = faceTrackingSupported
        phase = faceTrackingSupported ? .needsPermission : .unsupported
        super.init()
    }

    func onAppear() {
        guard !appeared else { return }
        appeared = true
        guard faceTrackingSupported else {
            phase = .unsupported
            return
        }
        UIApplication.shared.isIdleTimerDisabled = true
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            enterTracking()
            startSession()
        case .denied, .restricted:
            phase = .permissionDenied
        case .notDetermined:
            phase = .needsPermission
        @unknown default:
            phase = .needsPermission
        }
    }

    func onDisappear() {
        UIApplication.shared.isIdleTimerDisabled = false
    }

    func requestCameraAccess() {
        AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
            Task { @MainActor in
                guard let self else { return }
                if granted {
                    self.enterTracking()
                    self.startSession()
                } else {
                    self.phase = .permissionDenied
                }
            }
        }
    }

    func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    /// Moves a supported device into the live gate without starting ARKit.
    /// Tests use this. The app calls it only after camera permission is granted.
    func enterTracking() {
        guard faceTrackingSupported else {
            phase = .unsupported
            return
        }
        guard phase != .captured else { return }
        phase = .searching(detail: "Starting the camera")
    }

    func startSession() {
        guard ARFaceTrackingConfiguration.isSupported else {
            phase = .unsupported
            return
        }
        let configuration = ARFaceTrackingConfiguration()
        configuration.maximumNumberOfTrackedFaces = 1
        configuration.isWorldTrackingEnabled = false
        if let format = ARFaceTrackingConfiguration.supportedVideoFormats.first(where: {
            $0.captureDeviceType == .builtInTrueDepthCamera
        }) {
            configuration.videoFormat = format
        }
        session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
        if phase != .captured {
            gate.reset()
            phase = .searching(detail: "Starting the camera")
        }
    }

    func ingest(_ sample: FaceCaptureSample) {
        guard isLive else { return }
        latestSample = sample
        switch gate.evaluate(sample.gateSample) {
        case .blocked(let detail), .holding(let detail):
            phase = .searching(detail: detail)
        case .ready:
            phase = .ready
        }
    }

    func noteTracking(normal: Bool, detail: String) {
        guard isLive else { return }
        if !normal {
            gate.reset()
            latestSample = nil
            phase = .searching(detail: detail)
        } else if latestSample == nil {
            phase = .searching(detail: "Looking for a face")
        }
    }

    func noteSessionInterrupted() {
        guard phase != .captured else { return }
        gate.reset()
        latestSample = nil
        phase = .searching(detail: "Camera was interrupted")
    }

    func fail(_ message: String) {
        guard phase != .captured else { return }
        phase = .failed(message: message)
    }

    func capture() {
        guard phase == .ready, let sample = latestSample else { return }
        let mesh = FaceMeshDocument.captured(
            vertices: sample.vertices,
            indices: sample.indices,
            textureCoordinates: sample.textureCoordinates,
            blendShapes: sample.blendShapes
        )
        do {
            try mesh.validate()
            document = mesh
            shareError = nil
            phase = .captured
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        } catch {
            document = nil
            phase = .failed(message: error.localizedDescription)
        }
    }

    func captureAgain() {
        document = nil
        shareError = nil
        gate.reset()
        latestSample = nil
        guard faceTrackingSupported else {
            phase = .unsupported
            return
        }
        phase = .searching(detail: "Looking for a face")
    }

    func retry() {
        document = nil
        shareError = nil
        gate.reset()
        latestSample = nil
        enterTracking()
        startSession()
    }

    func share() {
        guard let document else { return }
        do {
            let url = try FaceMeshFileWriter.write(document)
            shareError = nil
            presentShare(url: url)
        } catch {
            shareError = error.localizedDescription
        }
    }

    private var isLive: Bool {
        switch phase {
        case .searching, .ready:
            return true
        case .unsupported, .needsPermission, .permissionDenied, .captured, .failed:
            return false
        }
    }

    private func presentShare(url: URL) {
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
            let root = scene.keyWindow?.rootViewController
        else {
            shareError = "The share sheet could not open."
            return
        }
        let activity = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        root.topPresenter.present(activity, animated: true)
    }
}

extension CaptureController: ARSCNViewDelegate {
    nonisolated func renderer(_ renderer: SCNSceneRenderer, didUpdate node: SCNNode, for anchor: ARAnchor) {
        guard let face = anchor as? ARFaceAnchor else { return }
        let frame = session.currentFrame
        let sample = Self.makeSample(from: face, frame: frame)
        Task { @MainActor in
            self.ingest(sample)
        }
    }

    nonisolated func session(_ session: ARSession, cameraDidChangeTrackingState camera: ARCamera) {
        let tracking = Self.trackingDetail(for: camera.trackingState)
        Task { @MainActor in
            self.noteTracking(normal: tracking.normal, detail: tracking.detail)
        }
    }

    nonisolated func sessionWasInterrupted(_ session: ARSession) {
        Task { @MainActor in
            self.noteSessionInterrupted()
        }
    }

    nonisolated func session(_ session: ARSession, didFailWithError error: Error) {
        let message = error.localizedDescription
        Task { @MainActor in
            self.fail(message)
        }
    }

    nonisolated static func makeSample(from face: ARFaceAnchor, frame: ARFrame?) -> FaceCaptureSample {
        let geometry = face.geometry
        var shapes: [String: Float] = [:]
        shapes.reserveCapacity(face.blendShapes.count)
        for (key, value) in face.blendShapes {
            shapes[key.rawValue] = value.floatValue
        }
        let tracking = frame.map { trackingDetail(for: $0.camera.trackingState) }
        let facing = frame.map {
            NeutralFrameGate.facingDot(faceTransform: face.transform, cameraTransform: $0.camera.transform)
        }
        return FaceCaptureSample(
            isTracked: face.isTracked,
            trackingNormal: tracking?.normal ?? false,
            trackingDetail: tracking?.detail ?? "Starting the camera",
            blendShapes: shapes,
            vertices: geometry.vertices,
            indices: geometry.triangleIndices.map { Int($0) },
            textureCoordinates: geometry.textureCoordinates,
            facingDot: facing,
            time: CACurrentMediaTime()
        )
    }

    nonisolated static func trackingDetail(for state: ARCamera.TrackingState) -> (normal: Bool, detail: String) {
        switch state {
        case .normal:
            return (true, "Looking for a face")
        case .notAvailable:
            return (false, "Face tracking is unavailable")
        case .limited(.initializing):
            return (false, "Starting face tracking")
        case .limited(.excessiveMotion):
            return (false, "Hold the phone steady")
        case .limited(.insufficientFeatures):
            return (false, "Use more light and face the phone")
        case .limited(.relocalizing):
            return (false, "Finding the face again")
        case .limited:
            return (false, "Face tracking is limited")
        }
    }
}

private extension UIViewController {
    var topPresenter: UIViewController {
        presentedViewController?.topPresenter ?? self
    }
}
