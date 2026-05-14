import Foundation
import CoreGraphics
import ObjectiveC.runtime
import XCTest

private struct AutomationRequest: Decodable {
    let bundleId: String?
    let actions: [AutomationAction]
}

private struct AutomationAction: Decodable {
    let type: AutomationActionType
    let target: AutomationTarget?
    let text: String?
    let expected: String?
    let x: Double?
    let y: Double?
    let direction: SwipeDirection?
    let timeout: Double?
}

private struct AutomationTarget: Decodable {
    let id: String?
    let label: String?
    let kind: String?
    let index: Int?

    init(
        id: String? = nil,
        label: String? = nil,
        kind: String? = nil,
        index: Int? = nil
    ) {
        self.id = id
        self.label = label
        self.kind = kind
        self.index = index
    }
}

private enum AutomationActionType: String, Decodable {
    case launch
    case activate
    case tap
    case typeText
    case swipe
    case waitForExistence
    case assertText
}

private enum SwipeDirection: String, Decodable {
    case up
    case down
    case left
    case right
}

final class IOSClickDemoUITests: XCTestCase {
    override func setUpWithError() throws {
        // Put setup code here. This method is called before the invocation of each test method in the class.

        // In UI tests it is usually best to stop immediately when a failure occurs.
        continueAfterFailure = false

        // In UI tests it’s important to set the initial state - such as interface orientation - required for your tests before they run. The setUp method is a good place to do this.
    }

    override func tearDownWithError() throws {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
    }

    @MainActor
    func testTapTypeAndSwipeFlow() throws {
        let request = AutomationRequest(
            bundleId: nil,
            actions: [
                AutomationAction(type: .launch, target: nil, text: nil, expected: nil, x: nil, y: nil, direction: nil, timeout: nil),
                AutomationAction(type: .tap, target: AutomationTarget(id: "tap-demo.button", label: nil), text: nil, expected: nil, x: nil, y: nil, direction: nil, timeout: 10),
                AutomationAction(type: .assertText, target: AutomationTarget(id: "tap-demo.status", label: nil), text: nil, expected: "Tapped 1 time", x: nil, y: nil, direction: nil, timeout: 5),
                AutomationAction(type: .typeText, target: AutomationTarget(id: "text-demo.field", label: nil), text: "hello iphone", expected: nil, x: nil, y: nil, direction: nil, timeout: 5),
                AutomationAction(type: .assertText, target: AutomationTarget(id: "text-demo.output", label: nil), text: nil, expected: "hello iphone", x: nil, y: nil, direction: nil, timeout: 5),
                AutomationAction(type: .swipe, target: AutomationTarget(id: "demo.scrollView", label: nil), text: nil, expected: nil, x: nil, y: nil, direction: .up, timeout: nil),
                AutomationAction(type: .swipe, target: AutomationTarget(id: "demo.scrollView", label: nil), text: nil, expected: nil, x: nil, y: nil, direction: .up, timeout: nil),
                AutomationAction(type: .swipe, target: AutomationTarget(id: "demo.scrollView", label: nil), text: nil, expected: nil, x: nil, y: nil, direction: .up, timeout: nil),
                AutomationAction(type: .waitForExistence, target: AutomationTarget(id: "swipe-demo.target", label: nil), text: nil, expected: nil, x: nil, y: nil, direction: nil, timeout: 5),
            ]
        )

        try runAutomation(request)
    }

    @MainActor
    func testHttpDrivenAutomation() throws {
        let request = try decodeAutomationRequest()
        try runAutomation(request)
    }

    @MainActor
    func testDumpSynthesizedTapEventArchive() throws {
        let data = try createSynthesizedTapArchive(
            at: CGPoint(x: 120, y: 240),
            liftUpOffset: 0.05
        )
        print("SYNTHESIZED_TAP_ARCHIVE_BASE64=\(data.base64EncodedString())")
        XCTAssertGreaterThan(data.count, 0)
    }

    @MainActor
    func testHoldForDirectRemoteXpcSession() throws {
        let app = XCUIApplication()
        app.launch()

        let seconds = ProcessInfo.processInfo.environment["DIRECT_REMOTE_XPC_HOLD_SECONDS"]
            .flatMap(Double.init) ?? 30
        RunLoop.current.run(until: Date().addingTimeInterval(seconds))
    }

    @MainActor
    private func runAutomation(_ request: AutomationRequest) throws {
        let app = appForRequest(request)
        for action in request.actions {
            try perform(action, in: app)
        }
    }

    private func decodeAutomationRequest() throws -> AutomationRequest {
        guard let encoded = ProcessInfo.processInfo.environment["AUTOMATION_REQUEST_BASE64"],
              let data = Data(base64Encoded: encoded)
        else {
            XCTFail("AUTOMATION_REQUEST_BASE64 is missing or invalid")
            throw NSError(domain: "IOSClickDemoUITests", code: 1)
        }

        return try JSONDecoder().decode(AutomationRequest.self, from: data)
    }

    private func createSynthesizedTapArchive(
        at point: CGPoint,
        liftUpOffset: TimeInterval
    ) throws -> Data {
        guard let recordClass = NSClassFromString("XCSynthesizedEventRecord") as? NSObject.Type,
              let pathClass = NSClassFromString("XCPointerEventPath") as? NSObject.Type
        else {
            throw NSError(domain: "IOSClickDemoUITests", code: 10)
        }

        let recordAlloc = recordClass.perform(NSSelectorFromString("alloc"))?.takeUnretainedValue()
        guard let record = recordAlloc?.perform(NSSelectorFromString("initWithName:"), with: "direct-remote-xpc-tap")?.takeUnretainedValue() as? NSObject else {
            throw NSError(domain: "IOSClickDemoUITests", code: 11)
        }

        let pathAlloc = pathClass.perform(NSSelectorFromString("alloc"))?.takeUnretainedValue()
        let initSelector = NSSelectorFromString("initForTouchAtPoint:offset:")
        guard let pathAllocObject = pathAlloc as AnyObject?,
              let implementation = class_getMethodImplementation(pathClass, initSelector)
        else {
            throw NSError(domain: "IOSClickDemoUITests", code: 12)
        }

        typealias InitForTouchAtPoint = @convention(c) (AnyObject, Selector, CGPoint, Double) -> Unmanaged<AnyObject>
        let initForTouchAtPoint = unsafeBitCast(implementation, to: InitForTouchAtPoint.self)
        let path = initForTouchAtPoint(pathAllocObject, initSelector, point, 0.0).takeUnretainedValue()

        guard let path = path as? NSObject else {
            throw NSError(domain: "IOSClickDemoUITests", code: 12)
        }

        _ = path.perform(
            NSSelectorFromString("liftUpAtOffset:"),
            with: NSNumber(value: liftUpOffset)
        )
        _ = record.perform(NSSelectorFromString("addPointerEventPath:"), with: path)

        return try NSKeyedArchiver.archivedData(withRootObject: record, requiringSecureCoding: true)
    }

    private func appForRequest(_ request: AutomationRequest) -> XCUIApplication {
        if let bundleId = request.bundleId, !bundleId.isEmpty {
            return XCUIApplication(bundleIdentifier: bundleId)
        }
        return XCUIApplication()
    }

    @MainActor
    private func perform(_ action: AutomationAction, in app: XCUIApplication) throws {
        switch action.type {
        case .launch:
            app.launch()
        case .activate:
            app.activate()
        case .tap:
            if let target = action.target {
                let element = resolveElement(target, in: app)
                XCTAssertTrue(element.waitForExistence(timeout: action.timeout ?? 5))
                element.tap()
            } else {
                let coordinate = try resolveCoordinate(action, in: app)
                coordinate.tap()
            }
        case .typeText:
            let element = resolveElement(try requireTarget(action), in: app)
            XCTAssertTrue(element.waitForExistence(timeout: action.timeout ?? 5))
            element.tap()
            guard let text = action.text else {
                XCTFail("typeText action requires text")
                return
            }
            element.typeText(text)
        case .swipe:
            let element = action.target.map { resolveElement($0, in: app) } ?? app
            switch action.direction ?? .up {
            case .up:
                element.swipeUp()
            case .down:
                element.swipeDown()
            case .left:
                element.swipeLeft()
            case .right:
                element.swipeRight()
            }
        case .waitForExistence:
            let element = resolveElement(try requireTarget(action), in: app)
            XCTAssertTrue(element.waitForExistence(timeout: action.timeout ?? 5))
        case .assertText:
            let element = resolveElement(try requireTarget(action), in: app)
            XCTAssertTrue(element.waitForExistence(timeout: action.timeout ?? 5))
            let actual = element.label.isEmpty ? (element.value as? String ?? "") : element.label
            XCTAssertEqual(actual, action.expected ?? "")
        }
    }

    private func requireTarget(_ action: AutomationAction) throws -> AutomationTarget {
        guard let target = action.target else {
            throw NSError(domain: "IOSClickDemoUITests", code: 2)
        }
        return target
    }

    private func resolveElement(_ target: AutomationTarget, in app: XCUIApplication) -> XCUIElement {
        let elementType = resolveElementType(target.kind)

        if let id = target.id, !id.isEmpty {
            return app.descendants(matching: elementType)[id]
        }
        if let label = target.label, !label.isEmpty {
            let matches = app.descendants(matching: elementType).matching(NSPredicate(format: "label == %@", label))
            if let index = target.index, index >= 0 {
                return matches.element(boundBy: index)
            }
            return matches.firstMatch
        }
        if elementType != .any {
            let query = app.descendants(matching: elementType)
            if let index = target.index, index >= 0 {
                return query.element(boundBy: index)
            }
            return query.firstMatch
        }
        return app
    }

    private func resolveElementType(_ kind: String?) -> XCUIElement.ElementType {
        guard let kind else {
            return .any
        }

        switch kind.lowercased() {
        case "button":
            return .button
        case "textview", "text_view":
            return .textView
        case "textfield", "text_field":
            return .textField
        case "securetextfield", "secure_text_field":
            return .secureTextField
        case "cell":
            return .cell
        case "statictext", "static_text":
            return .staticText
        case "scrollview", "scroll_view":
            return .scrollView
        case "other":
            return .other
        default:
            return .any
        }
    }

    private func resolveCoordinate(_ action: AutomationAction, in app: XCUIApplication) throws -> XCUICoordinate {
        guard let x = action.x, let y = action.y else {
            throw NSError(domain: "IOSClickDemoUITests", code: 3)
        }
        return app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0)).withOffset(CGVector(dx: x, dy: y))
    }
}
