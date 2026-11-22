import SwiftUI

struct CaptureView: View {
    @StateObject private var controller = CaptureController()

    var body: some View {
        ZStack {
            Color(red: 0.05, green: 0.06, blue: 0.07).ignoresSafeArea()
            if controller.phase.showsCamera {
                FaceCameraView(controller: controller).ignoresSafeArea()
                FramingGuide()
            }
            VStack(alignment: .leading, spacing: 0) {
                Text("Face Analyzer")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(.ultraThinMaterial, in: Capsule())
                Spacer()
                controlCard
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 20)
        }
        .preferredColorScheme(.dark)
        .onAppear { controller.onAppear() }
        .onDisappear { controller.onDisappear() }
    }

    private var controlCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(controller.phase.title)
                .font(.title2.weight(.semibold))
                .accessibilityAddTraits(.isHeader)
            Text(controller.phase.detail)
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if controller.phase == .captured, let document = controller.document {
                Text("\(document.vertexCount.formatted()) vertices · \(document.triangleCount.formatted()) triangles")
                    .font(.headline.monospacedDigit())
            }
            if let shareError = controller.shareError {
                Text(shareError)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
            actionButtons
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    @ViewBuilder
    private var actionButtons: some View {
        switch controller.phase {
        case .needsPermission:
            Button("Allow Camera", action: controller.requestCameraAccess)
                .buttonStyle(CaptureButtonStyle(prominent: true))
        case .permissionDenied:
            Button("Open Settings", action: controller.openSettings)
                .buttonStyle(CaptureButtonStyle(prominent: true))
        case .searching, .ready:
            Button("Capture", action: controller.capture)
                .buttonStyle(CaptureButtonStyle(prominent: true))
                .disabled(controller.phase != .ready)
                .opacity(controller.phase == .ready ? 1 : 0.45)
        case .captured:
            HStack(spacing: 10) {
                Button("Capture Again", action: controller.captureAgain)
                    .buttonStyle(CaptureButtonStyle(prominent: false))
                Button("Share", action: controller.share)
                    .buttonStyle(CaptureButtonStyle(prominent: true))
            }
        case .failed:
            Button("Try Again", action: controller.retry)
                .buttonStyle(CaptureButtonStyle(prominent: true))
        case .unsupported:
            EmptyView()
        }
    }
}

private struct FramingGuide: View {
    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width * 0.76
            let height = min(geo.size.height * 0.48, width * 1.25)
            let originY = geo.size.height * 0.12
            ZStack {
                Path { path in
                    path.addRect(CGRect(origin: .zero, size: geo.size))
                    path.addEllipse(in: CGRect(
                        x: (geo.size.width - width) / 2,
                        y: originY,
                        width: width,
                        height: height
                    ))
                }
                .fill(Color.black.opacity(0.38), style: FillStyle(eoFill: true))
                Ellipse()
                    .strokeBorder(Color.white.opacity(0.9), lineWidth: 1.5)
                    .frame(width: width, height: height)
                    .position(x: geo.size.width / 2, y: originY + height / 2)
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

private struct CaptureButtonStyle: ButtonStyle {
    var prominent: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .frame(maxWidth: .infinity)
            .frame(minHeight: 48)
            .foregroundStyle(prominent ? Color.black : Color.white)
            .background(
                prominent ? Color.white : Color.white.opacity(0.16),
                in: RoundedRectangle(cornerRadius: 14, style: .continuous)
            )
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}
