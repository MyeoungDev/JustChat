#!/usr/bin/env python3
"""Exercise reversible Just Browse toolbar actions through Orca accessibility UI."""

import json
import re
import subprocess
import sys
import time


APP = sys.argv[1] if len(sys.argv) > 1 else "com.justchat.justbrowse"


def run(*args):
    result = subprocess.run(
        ["orca", "computer", *args, "--app", APP, "--json", "--no-screenshot"],
        check=True,
        capture_output=True,
        text=True,
        timeout=15,
    )
    payload = json.loads(result.stdout)
    if not payload.get("ok"):
        raise RuntimeError(payload.get("error", {}).get("message", result.stdout))
    return payload["result"]


def state():
    return run("get-app-state", "--max-elements", "100")["snapshot"]["treeText"]


def control_index(tree, label):
    match = re.search(rf"^\s*(\d+) .*{re.escape(label)}", tree, re.M | re.I)
    if not match:
        raise AssertionError(f"Toolbar control not found: {label}\n{tree}")
    return match.group(1)


def click_and_wait(label, expected):
    tree = state()
    index = control_index(tree, label)
    run("click", "--element-index", index)
    deadline = time.monotonic() + 4
    while time.monotonic() < deadline:
        tree = state()
        if expected in tree:
            print(f"PASS {label} -> {expected}")
            return
        time.sleep(0.15)
    raise AssertionError(f"{label} did not produce {expected}\n{tree}")


def toggle_pair(before, after):
    click_and_wait(before, after)
    click_and_wait(after, before)


def toggle_from_current_state(first, second):
    tree = state()
    if first in tree:
        toggle_pair(first, second)
    elif second in tree:
        toggle_pair(second, first)
    else:
        raise AssertionError(f"Neither state is visible: {first} / {second}\n{tree}")


try:
    initial = state()
    if 'Window: "Just Browse"' not in initial:
        raise AssertionError("Just Browse must have a visible window before the UI smoke run")
    toggle_from_current_state("Keep window on top", "Unpin window")
    toggle_from_current_state("Mute website audio", "Unmute website audio")
    toggle_from_current_state("Maximize window", "Restore window")
    toggle_from_current_state("Fill current screen", "Restore screen")
    print("PASS all reversible toolbar actions returned to their initial state")
except Exception as error:
    print(f"FAIL {error}", file=sys.stderr)
    sys.exit(1)
