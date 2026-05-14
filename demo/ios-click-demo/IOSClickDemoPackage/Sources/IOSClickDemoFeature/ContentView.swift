import SwiftUI

public struct ContentView: View {
    @State private var directTapCount = 0
    @State private var tapCount = 0
    @State private var message = ""

    private var statusText: String {
        tapCount == 0 ? "Ready for interaction" : "Tapped \(tapCount) time\(tapCount == 1 ? "" : "s")"
    }

    private var directTapStatus: String {
        directTapCount == 0
            ? "Waiting for direct testmanagerd tap"
            : "Direct tap received \(directTapCount) time\(directTapCount == 1 ? "" : "s")"
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("iPhone Interaction Demo")
                            .font(.largeTitle.bold())
                        Text("Use this screen to verify tap, text entry, and swipe automation on a real device.")
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Direct RemoteXPC Tap Demo")
                            .font(.headline)
                        Text(directTapStatus)
                            .accessibilityIdentifier("direct-tap.status")

                        RoundedRectangle(cornerRadius: 28)
                            .fill(
                                LinearGradient(
                                    colors: [Color.orange.opacity(0.18), Color.red.opacity(0.12)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(maxWidth: .infinity)
                            .frame(height: 260)
                            .overlay {
                                VStack(spacing: 10) {
                                    Text("Tap Anywhere In This Zone")
                                        .font(.title2.bold())
                                    Text("The direct testmanagerd demo injects a coordinate tap here and the app logs a validation line.")
                                        .multilineTextAlignment(.center)
                                        .foregroundStyle(.secondary)
                                        .padding(.horizontal, 20)
                                }
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                directTapCount += 1
                                NSLog("[DirectRemoteXPCDemo] direct tap zone tapped count=%d", directTapCount)
                            }
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Tap demo")
                            .font(.headline)
                        Text(statusText)
                            .accessibilityIdentifier("tap-demo.status")

                        Button("Tap the iPhone") {
                            tapCount += 1
                        }
                        .buttonStyle(.borderedProminent)
                        .accessibilityIdentifier("tap-demo.button")
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Text input demo")
                            .font(.headline)

                        TextField("Type something", text: $message)
                            .textFieldStyle(.roundedBorder)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .accessibilityIdentifier("text-demo.field")

                        Text(message.isEmpty ? "No text entered yet" : message)
                            .foregroundStyle(message.isEmpty ? .secondary : .primary)
                            .accessibilityIdentifier("text-demo.output")
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Swipe demo")
                            .font(.headline)
                        Text("Swipe down until you can see the target card.")
                            .foregroundStyle(.secondary)

                        LazyVStack(spacing: 12) {
                            ForEach(1...18, id: \.self) { index in
                                RoundedRectangle(cornerRadius: 20)
                                    .fill(index == 18 ? Color.green.opacity(0.2) : Color.blue.opacity(0.12))
                                    .frame(maxWidth: .infinity)
                                    .frame(height: index == 18 ? 120 : 84)
                                    .overlay(alignment: .leading) {
                                        Text(index == 18 ? "Swipe target reached" : "Demo card \(index)")
                                            .font(.headline)
                                            .padding(.horizontal, 16)
                                            .accessibilityIdentifier(index == 18 ? "swipe-demo.target" : "swipe-demo.cardLabel.\(index)")
                                    }
                            }
                        }
                    }
                }
                .padding(24)
            }
            .accessibilityIdentifier("demo.scrollView")
            .navigationTitle("IOSClickDemo")
        }
    }
    
    public init() {}
}
