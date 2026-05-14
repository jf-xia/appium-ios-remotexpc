这次方案的核心设计，不是“在手机上常驻一个 HTTP agent”，而是做了一个更稳的桥接层：

本机 HTTP 请求 -> 本机 Node 服务 -> 触发真机 XCUITest -> 在目标 app 上执行点击 / 输入 / 滑动 -> 把结果返回给 HTTP 调用方。

之所以这么设计，是因为这个仓库本身更擅长 tunnel、DVT、RemoteXPC、XCTest 编排，但并没有现成的“原生任意 tap / swipe / type”公开 API。前面调研里我确认了这一点：截图可以直接走 DVT，高层服务入口在 src/services.ts，但真机 UI 交互更现实的路径是 XCTest。后来又确认了 `xcodebuildmcp` 的 `ui-automation` 只支持 simulator，不支持物理 iPhone，所以最终收敛到 “HTTP 驱动 XCUITest” 这个方案。

**设计过程**
一开始我先沿着仓库原有路线排查，确认了三件事。第一，这个 repo 有截图和进程控制，但没有可直接复用的原生 tap API。第二，`usbmux` 对你这台 WiFi iPhone 不可见，但 `devicectl` 能看见，并且能看到目标设备 `00008140-001465202E10801C` 已经是 `localNetwork` + `tunnelState=connected`。第三，设备上已经安装了 `WebDriverAgentRunner`，但直接走 WDA 的 HTTP 端口在当前环境下并不稳定，且仓库并没有现成把它可靠接出来的链路。基于这些约束，我没有继续硬拼一个低层 native tap 协议，而是转成了 XCUITest 驱动，因为这条路在真机上是可验证、可签名、可闭环的。

接着我做了一个最小 iOS 工程作为执行宿主，放在 demo/ios-click-demo。页面本身在 ContentView.swift，先用它验证点击、输入、滑动三件事。然后把 UI test 从“写死的 demo 流程”抽象成“动作解释器”，实现在 IOSClickDemoUITests.swift。最后在本机增加一个 Node HTTP 服务 iphone-http-automation-server.mjs，让外部通过 `GET` / `POST` 请求描述动作，再由服务把动作注入测试流程。

**开发过程**
工程层面先修了两个基础问题。一个是 demo 工程的 `.xcodeproj` 本地 Swift package 引用不完整，导致直接打开项目时报 “Missing package product 'IOSClickDemoFeature'”。这个通过补全 project.pbxproj 里的本地 package reference，以及修正嵌入 workspace 解决了。另一个是签名配置不一致，app target、test target 和 xcconfig 里用的 team 混在一起，最后实测对你的设备真正可用的是 `27WY6645VZ`，所以把默认 team 收敛到了 Shared.xcconfig，同时把 UI test target 的 bundle id 独立成 Tests.xcconfig 里的 `com.jianfeng.iosclickdemo.uitests`。

HTTP 控制这部分，关键难点不是“起个 server”，而是“怎么把 HTTP 请求内容传进真机 UI test”。我先验证过 `xcodebuildmcp simulator test` 不会把 shell 环境变量透传进 UI test，所以没有走那条链。最终方案是：HTTP server 收到请求后，把动作 JSON 编成 base64，临时写进 IOSClickDemo.xctestplan 的环境变量，再调用 `xcrun xcodebuild ... test`，只跑 IOSClickDemoUITests.swift 里的 `testHttpDrivenAutomation`。这个测试方法会 decode 请求，按顺序执行 `launch`、`activate`、`tap`、`typeText`、`swipe`、`waitForExistence`、`assertText` 这些动作。server 执行完成后，再把 test plan 恢复原状，避免污染后续测试。

**用了哪些技术**
技术栈主要有这几类：

- Node.js / ESM：本机服务和脚本层
- SwiftUI：demo app 页面
- XCUITest：真机动作执行
- `xcrun xcodebuild`：真正的 device test 执行器
- `xcodebuildmcp`：前期工程脚手架、构建验证和设备能力勘探
- `node-devicectl`：设备发现、安装 app 列表、确认 WiFi 设备状态
- XCTest plan 注入：把 HTTP 请求桥接到 UI test 执行上下文
- 本地 JSON over HTTP：作为最终对外调用接口

这些关键实现点分别在下面几个文件：

- HTTP server: iphone-http-automation-server.mjs
- demo client: iphone-http-automation-demo-request.mjs
- UI 动作执行器: IOSClickDemoUITests.swift
- demo app 页面: ContentView.swift
- npm 入口: package.json

**整个流程怎么跑通**
现在跑通路径已经是完整的：

1. 启动本机 HTTP 服务：
   `npm run demo:iphone:http-server`

2. 服务监听在 `http://127.0.0.1:4726`

3. 你发请求：
   `GET /demo/run`
   或
   `POST /automation/run`

4. 服务读取请求体，默认使用你指定的 UDID `00008140-001465202E10801C`

5. 服务把动作请求写进 IOSClickDemo.xctestplan 的环境变量

6. 服务调用：
   `xcrun xcodebuild -workspace ... -scheme IOSClickDemo -destination id=00008140-001465202E10801C -allowProvisioningUpdates DEVELOPMENT_TEAM=27WY6645VZ -only-testing:IOSClickDemoUITests/IOSClickDemoUITests/testHttpDrivenAutomation test`

7. 真机上的 UI test runner 启动，解码动作，执行点击 / 输入 / 滑动

8. `xcodebuild` 退出后，服务把 `stdout`、`stderr`、`exitCode` 和请求内容作为 JSON 返回

这条链我已经实际验证过两次：

- `GET /demo/run` 成功返回 `success: true`
- 自定义 `POST /automation/run` 也成功返回 `success: true`

你现在终端里那两次 `curl ... /automation/run` 的 `Exit Code: 0`，就是这条链真正跑通的结果。

**当前方案的能力边界**
现在这个版本已经能通过 HTTP 请求执行真机点击和输入，但它不是一个“常驻在设备上的实时控制协议”，而是“每个 HTTP 请求触发一次 XCUITest run”。这意味着：

- 优点是稳定、可签名、容易落地
- 缺点是每次请求都有秒级启动开销
- 适合 demo、业务流验证、低频自动化
- 不适合高频、低延迟的实时遥控

另外，控制别的 app 是可以的，但前提还是 XCTest 那套规则：最好目标 app 有 accessibility id 或 label；如果没有，也能用坐标点，但鲁棒性会差很多。

**后续优化建议**
1. 做成动作队列而不是“一请求一测试”。
现在 server 是串行单任务模型，且一次请求只跑一次 `xcodebuild test`。可以加队列和批量动作，让一次测试会话执行更多步骤，减少启动成本。

2. 增加元素发现和截图能力。
下一步最值得补的是 `screenshot`、`dump visible labels`、`waitUntilGone`、`pressHome`、`terminateApp` 这些动作。这样 HTTP API 会更像一个真正的 automation service。

3. 增加坐标归一化。
现在坐标是像素偏移语义，最好改成支持归一化坐标 `$x \in [0,1], y \in [0,1]$`，适配不同屏幕尺寸更稳。

4. 对别的 app 增加目标切换辅助。
可以再加几个动作：`launchBundleId`、`activateBundleId`、`waitForApp`，把跨 app 操作做得更显式。

5. 如果目标变成“高频实时控制”，换路线。
如果你后面要做的是持续控制任意 app、频繁点击、低延迟输入，那建议切到 WebDriverAgent / Appium 的常驻会话模型，而不是继续把 XCUITest 当成一次性 RPC 容器。当前这个版本更偏“低成本可落地桥接”。

6. 修正当前签名配置来源。
虽然当前链路能跑，但签名 identity 和 `DEVELOPMENT_TEAM` 还存在 Xcode 自动修正痕迹。最好在 Xcode 里把实际账号、team、profile 再统一清理一次，避免后续换机器或换账号时出漂移。

如果你要继续推进，最自然的下一步是这两个方向之一：

1. 我直接把 HTTP API 扩展成一套更完整的动作协议，补上截图、启动/终止 app、按坐标点击和更多等待条件。
2. 我拿一个你手机上真实的第三方 app，给你做一条真正“打开 app -> 点按钮 -> 输入文字”的 POST 请求示例。