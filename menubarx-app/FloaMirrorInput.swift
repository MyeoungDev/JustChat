import ApplicationServices
import CoreGraphics
import Foundation

private func reply(_ id: Any?, _ values: [String: Any]) {
    var result = values
    if let id { result["id"] = id }
    guard JSONSerialization.isValidJSONObject(result),
          let data = try? JSONSerialization.data(withJSONObject: result),
          let line = String(data: data, encoding: .utf8) else { return }
    print(line)
    fflush(stdout)
}

private func windowInfo(_ windowID: CGWindowID) -> (pid: pid_t, bounds: CGRect, title: String)? {
    let options: CGWindowListOption = [.optionIncludingWindow, .optionOnScreenOnly]
    guard let rows = CGWindowListCopyWindowInfo(options, windowID) as? [[String: Any]],
          let row = rows.first(where: { ($0[kCGWindowNumber as String] as? NSNumber)?.uint32Value == windowID }),
          let pid = row[kCGWindowOwnerPID as String] as? pid_t,
          let rawBounds = row[kCGWindowBounds as String] as? [String: CGFloat],
          let x = rawBounds["X"], let y = rawBounds["Y"],
          let width = rawBounds["Width"], let height = rawBounds["Height"],
          width > 0, height > 0 else { return nil }
    return (pid, CGRect(x: x, y: y, width: width, height: height), row[kCGWindowName as String] as? String ?? "")
}

private func axWindow(pid: pid_t, title: String, bounds: CGRect) -> AXUIElement? {
    let app = AXUIElementCreateApplication(pid)
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &value) == .success,
          let windows = value as? [AXUIElement] else { return nil }
    var best: AXUIElement?
    var bestDistance = CGFloat.greatestFiniteMagnitude
    for window in windows {
        var titleValue: CFTypeRef?
        _ = AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &titleValue)
        let candidateTitle = titleValue as? String ?? ""
        if !title.isEmpty && candidateTitle != title { continue }
        var positionValue: CFTypeRef?
        var sizeValue: CFTypeRef?
        _ = AXUIElementCopyAttributeValue(window, kAXPositionAttribute as CFString, &positionValue)
        _ = AXUIElementCopyAttributeValue(window, kAXSizeAttribute as CFString, &sizeValue)
        var position = CGPoint.zero
        var size = CGSize.zero
        if let positionValue, CFGetTypeID(positionValue) == AXValueGetTypeID() {
            _ = AXValueGetValue(positionValue as! AXValue, .cgPoint, &position)
        }
        if let sizeValue, CFGetTypeID(sizeValue) == AXValueGetTypeID() {
            _ = AXValueGetValue(sizeValue as! AXValue, .cgSize, &size)
        }
        let distance = abs(position.x - bounds.minX) + abs(position.y - bounds.minY)
            + abs(size.width - bounds.width) + abs(size.height - bounds.height)
        if distance < bestDistance { best = window; bestDistance = distance }
    }
    return best
}

private func target(_ request: [String: Any]) -> (id: Any?, info: (pid_t, CGRect, String))? {
    guard let id = request["id"], let number = request["windowId"] as? NSNumber,
          number.uint32Value != 0, let info = windowInfo(number.uint32Value) else { return nil }
    return (id, info)
}

while let line = readLine() {
    guard let data = line.data(using: .utf8),
          let request = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        reply(nil, ["ok": false, "error": "Invalid request."])
        continue
    }
    let id = request["id"]
    let action = request["action"] as? String ?? ""
    if action == "accessibility" {
        let shouldPrompt = request["prompt"] as? Bool ?? false
        let trusted: Bool
        if shouldPrompt {
            let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
            trusted = AXIsProcessTrustedWithOptions(options)
        } else {
            trusted = AXIsProcessTrusted()
        }
        reply(id, ["ok": true, "trusted": trusted])
        continue
    }
    guard let target = target(request) else {
        reply(id, ["ok": false, "error": "The selected window is no longer available."])
        continue
    }
    let (_, info) = target
    let (pid, bounds, title) = info
    if action == "info" {
        reply(id, ["ok": true, "pid": Int(pid), "title": title,
                   "bounds": ["x": bounds.minX, "y": bounds.minY, "width": bounds.width, "height": bounds.height]])
        continue
    }

    guard AXIsProcessTrusted() else {
        reply(id, ["ok": false, "needsAccessibility": true,
                   "error": "Enable Accessibility for Floa Mirror Input in System Settings to control a mirrored window."])
        continue
    }

    if action == "raise" {
        guard let window = axWindow(pid: pid, title: title, bounds: bounds),
              AXUIElementPerformAction(window, kAXRaiseAction as CFString) == .success else {
            reply(id, ["ok": false, "error": "Could not raise the selected window. It may no longer be available."])
            continue
        }
        reply(id, ["ok": true])
        continue
    }

    let x = min(1, max(0, request["x"] as? CGFloat ?? 0.5))
    let y = min(1, max(0, request["y"] as? CGFloat ?? 0.5))
    let point = CGPoint(x: bounds.minX + x * bounds.width, y: bounds.minY + y * bounds.height)
    let flags = CGEventFlags(rawValue: (request["flags"] as? NSNumber)?.uint64Value ?? 0)
    var event: CGEvent?
    switch action {
    case "move":
        event = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)
    case "down", "up", "rightDown", "rightUp", "drag", "rightDrag":
        let right = action.hasPrefix("right")
        let isDrag = action.hasSuffix("Drag")
        let down = action.hasSuffix("Down") || action == "down"
        let type: CGEventType = isDrag ? (right ? .rightMouseDragged : .leftMouseDragged)
            : (right ? (down ? .rightMouseDown : .rightMouseUp) : (down ? .leftMouseDown : .leftMouseUp))
        event = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: right ? .right : .left)
    case "wheel":
        event = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2,
                        wheel1: Int32(request["deltaY"] as? Int ?? 0),
                        wheel2: Int32(request["deltaX"] as? Int ?? 0), wheel3: 0)
        event?.location = point
    case "keyDown", "keyUp":
        guard let code = request["keyCode"] as? NSNumber, code.intValue >= 0, code.intValue <= 127 else {
            reply(id, ["ok": false, "error": "Unsupported key."])
            continue
        }
        event = CGEvent(keyboardEventSource: nil, virtualKey: CGKeyCode(code.uint16Value), keyDown: action == "keyDown")
    default:
        reply(id, ["ok": false, "error": "Unsupported input event."])
        continue
    }
    guard let event else {
        reply(id, ["ok": false, "error": "Could not create the input event."])
        continue
    }
    if action == "keyDown" || action == "keyUp" { event.flags = flags }
    event.postToPid(pid)
    reply(id, ["ok": true])
}
