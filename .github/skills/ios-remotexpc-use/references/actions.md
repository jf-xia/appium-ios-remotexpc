# Action JSON

## Top-Level Shape

```json
{
  "bundleId": "com.jianfeng.iosclickdemo",
  "actions": [
    { "type": "launch" }
  ]
}
```

Optional top-level fields accepted by the wrapper script:
- `udid`
- `teamId`

## Supported Actions

### `launch`
```json
{ "type": "launch" }
```

### `activate`
```json
{ "type": "activate" }
```

### `tap`
By accessibility id:

```json
{
  "type": "tap",
  "target": { "id": "tap-demo.button" },
  "timeout": 10
}
```

By absolute coordinates:

```json
{
  "type": "tap",
  "x": 200,
  "y": 260
}
```

### `typeText`
```json
{
  "type": "typeText",
  "target": { "id": "text-demo.field" },
  "text": "hello iphone",
  "timeout": 5
}
```

### `swipe`
```json
{
  "type": "swipe",
  "target": { "id": "demo.scrollView" },
  "direction": "up"
}
```

### `waitForExistence`
```json
{
  "type": "waitForExistence",
  "target": { "id": "swipe-demo.target" },
  "timeout": 5
}
```

### `assertText`
```json
{
  "type": "assertText",
  "target": { "id": "tap-demo.status" },
  "expected": "Tapped 1 time",
  "timeout": 5
}
```

## Target Shape

```json
{
  "target": {
    "id": "accessibility-id",
    "label": "Visible label"
  }
}
```

Use `id` first. Use `label` only when accessibility ids are unavailable.