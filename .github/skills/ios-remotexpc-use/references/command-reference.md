# Command Reference

## Core Commands

Start server:

```bash
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_server.sh --start
```

Run a JSON batch:

```bash
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_run.sh \
  --request-file path/to/request.json
```

Capture screenshot:

```bash
sudo bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_snapshot.sh
```

## Single-Action Wrappers

Launch an app:

```bash
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_launch.sh \
  --bundle-id com.apple.Preferences
```

Tap a coordinate:

```bash
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_tap.sh \
  --bundle-id com.apple.mobilenotes \
  --x 360 --y 810
```

Tap a target:

```bash
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_tap.sh \
  --bundle-id com.jianfeng.iosclickdemo \
  --id tap-demo.button \
  --timeout 10
```

Type text into the first text view:

```bash
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_type.sh \
  --bundle-id com.apple.mobilenotes \
  --kind textView --index 0 \
  --text 'hello from skill'
```

Swipe a scroll view:

```bash
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_swipe.sh \
  --bundle-id com.jianfeng.iosclickdemo \
  --kind scrollView --index 0 \
  --direction up
```

Wait for an element:

```bash
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_wait.sh \
  --bundle-id com.jianfeng.iosclickdemo \
  --id swipe-demo.target \
  --timeout 5
```

Assert text:

```bash
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_assert_text.sh \
  --bundle-id com.jianfeng.iosclickdemo \
  --id tap-demo.status \
  --expected 'Tapped 1 time'
```

## Notes Demo

```bash
bash .github/skills/ios-remotexpc-use/scripts/ios_remotexpc_notes_log.sh \
  --text $'操作记录\n1. 启动备忘录\n2. 新建备忘录\n3. 写入本次自动化记录'
```