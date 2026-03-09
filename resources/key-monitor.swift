// BasicsOS global key monitor — uses CGEventTap to detect keyDown, keyUp,
// and modifier-only presses (including Fn/Globe) on macOS.
// Outputs JSON lines to stdout; exits on error to stderr.

import Cocoa

// Map modifier keyCodes to their flag bit so we can detect press vs release
// from flagsChanged events.
let modifierKeyToFlag: [Int64: UInt64] = [
    55: 0x100000,  // Left Command
    54: 0x100000,  // Right Command
    56: 0x020000,  // Left Shift
    60: 0x020000,  // Right Shift
    58: 0x080000,  // Left Option
    61: 0x080000,  // Right Option
    59: 0x040000,  // Left Control
    62: 0x040000,  // Right Control
    63: 0x800000,  // Fn/Globe
    57: 0x010000,  // Caps Lock
]

var eventTap: CFMachPort?

func emit(_ type: String, _ keyCode: Int64, _ flags: UInt64) {
    print("{\"t\":\"\(type)\",\"k\":\(keyCode),\"f\":\(flags)}")
    fflush(stdout)
}

func callback(
    proxy: CGEventTapProxy,
    type: CGEventType,
    event: CGEvent,
    refcon: UnsafeMutableRawPointer?
) -> Unmanaged<CGEvent>? {
    switch type {
    case .tapDisabledByTimeout, .tapDisabledByUserInput:
        // Re-enable the tap if the system disabled it
        if let tap = eventTap {
            CGEvent.tapEnable(tap: tap, enable: true)
        }
        return Unmanaged.passRetained(event)
    default:
        break
    }

    let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
    let flags = event.flags.rawValue

    switch type {
    case .keyDown:
        emit("d", keyCode, flags)
    case .keyUp:
        emit("u", keyCode, flags)
    case .flagsChanged:
        if let ownFlag = modifierKeyToFlag[keyCode] {
            let isDown = (flags & ownFlag) != 0
            emit(isDown ? "d" : "u", keyCode, flags)
        }
    default:
        break
    }

    return Unmanaged.passRetained(event)
}

// ── Check Accessibility permission ──────────────────────────────────────

if !AXIsProcessTrusted() {
    let opts = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true] as CFDictionary
    AXIsProcessTrustedWithOptions(opts)
    fputs("ERROR:accessibility\n", stderr)
    exit(1)
}

// ── Create event tap ────────────────────────────────────────────────────

let mask: CGEventMask =
    (1 << CGEventType.keyDown.rawValue)
    | (1 << CGEventType.keyUp.rawValue)
    | (1 << CGEventType.flagsChanged.rawValue)

guard let tap = CGEvent.tapCreate(
    tap: .cghidEventTap,
    place: .headInsertEventTap,
    options: .listenOnly,
    eventsOfInterest: mask,
    callback: callback,
    userInfo: nil
) else {
    fputs("ERROR:tap_failed\n", stderr)
    exit(2)
}

eventTap = tap

let source = CFMachPortCreateRunLoopSource(nil, tap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), source, .commonModes)
CGEvent.tapEnable(tap: tap, enable: true)

print("{\"t\":\"ready\"}")
fflush(stdout)
CFRunLoopRun()
