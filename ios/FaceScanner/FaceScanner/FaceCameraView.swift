import ARKit
import SwiftUI

struct FaceCameraView: UIViewRepresentable {
    let controller: CaptureController

    func makeUIView(context: Context) -> ARSCNView {
        let view = ARSCNView(frame: .zero)
        view.automaticallyUpdatesLighting = false
        view.session = controller.session
        view.delegate = controller
        return view
    }

    func updateUIView(_ uiView: ARSCNView, context: Context) {
        if uiView.session !== controller.session {
            uiView.session = controller.session
        }
        uiView.delegate = controller
    }
}
