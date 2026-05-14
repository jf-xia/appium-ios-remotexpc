import Testing
@testable import IOSClickDemoFeature

@MainActor
@Test func contentViewInitialises() async throws {
    let view = ContentView()
    #expect(String(describing: view).contains("ContentView"))
}
