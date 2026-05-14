现在给你做一个完整总结。

---

## 一、整体设计与技术路线

### 原始需求
做一个脚本，能操作 iPhone 真机——截图、点击、滑动、输入文本等各种交互。要求从最小 demo 开始，不需要通过 XCTest 运行器，而是直接用 `com.apple.testmanagerd` 的 RemoteXPC 服务。

### 技术路线演进

**阶段1：仓库现有能力边界勘探**
- 确认这个仓库（`appium-ios-remotexpc`）有截图（DVT）、进程控制、端口转发、XCTest 编排能力
- 确认仓库**没有**现成的原生 tap/swipe/type 公开 API
- 确认 `xcodebuildmcp ui-automation` 只支持 simulator，不支持真机
- 确认 `devicectl` 能看到你的 WiFi iPhone（UDID: `00008140-001465202E10801C`），但 `usbmuxd` 当时看不到 WiFi 设备

**阶段2：HTTP 驱动的 XCUITest 方案（先落地）**
- 做了最小 iOS demo 工程 `demo/ios-click-demo`，包含可点击按钮、文本输入、可滑动区域
- 把 UI test 改造成"动作解释器"，支持 `launch`、`activate`、`tap`、`typeText`、`swipe`、`waitForExistence`、`assertText`
- 做了本机 Node HTTP 服务（端口 4726），把 HTTP 请求注入 xctestplan 环境变量，触发真机 XCUITest 执行
- 这个方案能跑通，但每次请求触发一次完整 XCUITest run，延迟秒级

**阶段3：testmanagerd 直连方案（你后来要求的方向）**
- 逆向 Apple 私有类 `XCSynthesizedEventRecord`、`XCPointerEventPath`、`XCPointerEvent`，拿到真实对象图
- 实现了 `testmanagerd-encoder.ts` 里的 tap 事件归档编码
- 实现了 `direct-device-events.ts` 里的 `performDirectTap()`
- 做了探针测试，成功 dump 出 Apple 自己生成的 tap 事件归档，坐标 `(120, 240)` 精确对应
- 最后停在"通道层"：`_XCT_performDeviceEvent:completion:` 不能发到 `XCIDESession`，需要 runner-daemon 通道

**阶段4：runner-daemon 方案**
- 切换到 `xctrunner` 会话：启动 runner、发 `XCTestConfiguration`、`start test plan`
- 添加保活测试 `testHoldForDirectRemoteXpcSession`（空测试，只保持 runner 活着）
- 添加 `testsToRun/testsToSkip` 透传到 `XCTestConfiguration`
- 修复了 bundle 路径问题（`IOSClickDemo.xctest` → `IOSClickDemoUITests.xctest`）
- 修复了 `stop()` 卡死问题（关连接顺序：先关 exec/control，再等监听器）
- 当前状态：runner 能起来，hold test 能跑，目标 app 被拉起（PID > 0），但 direct tap 本身还未命中

**阶段5：创建 workspace skill**
- 基于当前更稳定的 HTTP automation 能力，创建了 `.github/skills/ios-remotexpc-use/SKILL.md`
- 封装了薄脚本：`server.sh`、`run.sh`、`snapshot.sh`、`launch.sh`、`tap.sh`、`type.sh`、`swipe.sh`、`wait.sh`、`assert_text.sh`、`notes_log.sh`
- 添加了 `kind/index` 定位（如 `textView[0]`），能操控系统 App 的控件
- 跑通了"打开备忘录 + 新建 + 写入操作记录"的完整场景

---

## 二、关键技术点

| 技术 | 作用 | 文件位置 |
|------|------|----------|
| RemoteXPC | 设备隧道通信 | `src/lib/remote-xpc/` |
| `testmanagerd` | UI 自动化核心服务 | `src/services/ios/testmanagerd/` |
| `DVT` screenshot | 截图能力 | `src/services/ios/dvt/instruments/screenshot.ts` |
| `node-devicectl` | 设备发现、app 列表、隧道状态 | `node_modules/node-devicectl/` |
| XCUITest | HTTP 驱动的执行器 | `demo/ios-click-demo/IOSClickDemoUITests/` |
| XCTest plan 注入 | 把 HTTP 请求传到 UI test | `IOSClickDemo.xctestplan` |
| `XCSynthesizedEventRecord` 归档 | 直连 tap 事件编码 | `testmanagerd-encoder.ts` |
| strongbox | tunnel registry 端口持久化 | `tunnel-registry-server.ts` |
| DTX 协议 | testmanagerd 消息格式 | `src/services/ios/dvt/dtx-message.ts` |

---

## 三、已修改/新增的文件清单

### 仓库核心
- `src/lib/tunnel/tunnel-registry-server.ts` — 修复端口写入 strongbox
- `src/services/ios/testmanagerd/testmanagerd-encoder.ts` — 添加 `XCSynthesizedEventRecord` 等归档
- `src/services/ios/testmanagerd/direct-device-events.ts` — `performDirectTap()` 直连 tap
- `src/services/ios/testmanagerd/xcuitest-common.ts` — 添加 `testsToRun/testsToSkip`
- `src/services/ios/testmanagerd/xcuitest.ts` — runner-daemon 支持 + `dispatchDirectTap()` + `stop()` 修复
- `src/index.ts` — 导出补充

### Demo 工程
- `demo/ios-click-demo/IOSClickDemoPackage/Sources/IOSClickDemoFeature/ContentView.swift` — demo 页面（按钮、输入、滑动、tap 日志区）
- `demo/ios-click-demo/IOSClickDemoUITests/IOSClickDemoUITests.swift` — UI test 动作解释器、保活测试、探针测试
- `demo/ios-click-demo/IOSClickDemo.xcodeproj/project.pbxproj` — 修复本地 package 引用、签名配置
- `demo/ios-click-demo/IOSClickDemo.xcodeproj/project.xcworkspace/contents.xcworkspacedata` — 修复 package 引用
- `demo/ios-click-demo/Config/Shared.xcconfig` — 签名 team 收敛
- `demo/ios-click-demo/Config/Tests.xcconfig` — UI test bundle id

### 脚本
- `scripts/iphone-screenshot-demo.mjs` — 自建 tunnel 截图
- `scripts/iphone-http-automation-server.mjs` — HTTP 自动化服务
- `scripts/iphone-http-automation-demo-request.mjs` — demo 请求
- `scripts/iphone-testmanagerd-direct-tap-demo.mjs` — 直连 tap demo（runner-daemon 版本）
- `package.json` — npm 入口

### Skill 目录
- `.github/skills/ios-remotexpc-use/SKILL.md` — skill 主文档
- `.github/skills/ios-remotexpc-use/scripts/ios_remotexpc_server.sh`
- `.github/skills/ios-remotexpc-use/scripts/ios_remotexpc_run.sh`
- `.github/skills/ios-remotexpc-use/scripts/ios_remotexpc_snapshot.sh`
- `.github/skills/ios-remotexpc-use/scripts/ios_remotexpc_launch.sh`
- `.github/skills/ios-remotexpc-use/scripts/ios_remotexpc_tap.sh`
- `.github/skills/ios-remotexpc-use/scripts/ios_remotexpc_type.sh`
- `.github/skills/ios-remotexpc-use/scripts/ios_remotexpc_swipe.sh`
- `.github/skills/ios-remotexpc-use/scripts/ios_remotexpc_wait.sh`
- `.github/skills/ios-remotexpc-use/scripts/ios_remotexpc_assert_text.sh`
- `.github/skills/ios-remotexpc-use/scripts/ios_remotexpc_notes_log.sh`
- `.github/skills/ios-remotexpc-use/references/workflow.md`
- `.github/skills/ios-remotexpc-use/references/actions.md`
- `.github/skills/ios-remotexpc-use/references/command-reference.md`
- `.github/skills/ios-remotexpc-use/assets/demo-request.json`
- `.github/skills/ios-remotexpc-use/assets/notes-log-request.json`

---

## 四、当前可运行状态

### ✅ 稳定可用
- HTTP 自动化：`npm run demo:iphone:http-server` → 发 `POST /automation/run`
- 截图：`sudo npm run demo:iphone:screenshot -- --udid 00008140-001465202E10801C`
- Workspace skill：`bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_run.sh --request-file ...`
- 打开备忘录 + 新建 + 写入操作记录场景已跑通

### 🔄 实验态（待收尾）
- `testmanagerd` 直连 tap：runner 会话能建立，hold test 能跑，目标 app 能拉起，但 tap 注入还未命中

---

## 五、后续优化建议

1. **收尾 direct tap**：在 runner-daemon 会话里找到正确的 `_XCT_performDeviceEvent` 通道，把 tap 注入打通
2. **截图不需要 sudo**：给截图脚本也改成自建 tunnel，和 direct tap 脚本一样
3. **动作队列**：现在一次请求跑一次 XCUITest，可以改成一个 runner 会话内多次动作
4. **坐标归一化**：支持 `[0,1]` 归一化坐标
5. **更多动作**：`screenshot`、`pressHome`、`terminateApp`、`dumpLabels`
6. **长连接**：如果想高频控制，切到 WebDriverAgent 常驻会话模型
7. **签名配置固化**：当前 team `27WY6645VZ` 是 Xcode 自动修正的，最好在 Xcode 里统一确认

---

现在你可以继续选择推进方向：
1. 继续把 direct tap 跑通
2. 把 skill 再细化（比如补更多单动作脚本、ReAct 模板）
3. 拿一个你手机上的真实 app 做更复杂的自动化场景