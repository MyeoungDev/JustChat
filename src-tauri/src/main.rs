#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};

use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashMap;
#[cfg(target_os = "macos")]
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::webview::{NewWindowResponse, PageLoadEvent};
use tauri::{
    window::Color, AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition,
    PhysicalSize, Theme, Webview, WebviewUrl, WebviewWindowBuilder, Window, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutEvent, ShortcutState};

const HEADER_HEIGHT: f64 = 48.0;
const DEFAULT_WIDTH: f64 = 520.0;
const DEFAULT_HEIGHT: f64 = 320.0;
const EXPANDED_HEIGHT: f64 = 480.0;
static NEXT_AUTH_POPUP_ID: AtomicU64 = AtomicU64::new(1);

fn is_allowed_chatgpt_auth_popup(url: &url::Url) -> bool {
    if url.scheme() != "https:" {
        return false;
    }
    let host = url.host_str().unwrap_or_default();
    [
        "chatgpt.com",
        "openai.com",
        "auth0.com",
        "google.com",
        "apple.com",
        "microsoftonline.com",
        "live.com",
        "microsoft.com",
        "challenges.cloudflare.com",
    ]
    .iter()
    .any(|domain| host == *domain || host.ends_with(&format!(".{domain}")))
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShellState {
    mode: String,
    provider_id: String,
    provider_state: String,
    settings_visible: bool,
    settings: Value,
    shortcut_failures: Vec<String>,
}

struct Runtime {
    window: Mutex<Option<Window>>,
    shell: Mutex<Option<Webview>>,
    provider: Mutex<Option<Webview>>,
    state: Mutex<ShellState>,
    settings_path: Mutex<Option<PathBuf>>,
    fullscreen_restore: Mutex<Option<FullscreenRestore>>,
    settings_restore: Mutex<Option<FullscreenRestore>>,
    transition_id: Arc<AtomicU64>,
}

struct FullscreenRestore {
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
    mode: String,
}

impl Default for Runtime {
    fn default() -> Self {
        Self {
            window: Mutex::new(None),
            shell: Mutex::new(None),
            provider: Mutex::new(None),
            state: Mutex::new(ShellState {
                mode: "compact".into(),
                provider_id: "chatgpt".into(),
                provider_state: "loading".into(),
                settings_visible: false,
                settings: default_settings(),
                shortcut_failures: Vec::new(),
            }),
            settings_path: Mutex::new(None),
            fullscreen_restore: Mutex::new(None),
            settings_restore: Mutex::new(None),
            transition_id: Arc::new(AtomicU64::new(0)),
        }
    }
}

fn provider_shortcut_script(settings: &Value, mode: &str) -> String {
    let (settings_shortcut, meta_modifier) = if cfg!(target_os = "macos") {
        ("Command+Comma", "Command")
    } else {
        ("Control+Comma", "Super")
    };
    let bindings = json!({
        "settings": settings_shortcut,
        "hide": "",
        "size": settings["shortcuts"]["toggleSize"].as_str().unwrap_or("Command+Shift+E"),
        "fullscreen": settings["shortcuts"]["toggleFullscreen"].as_str().unwrap_or("Command+Shift+F"),
        "temporaryChat": settings["shortcuts"]["temporaryChat"].as_str().unwrap_or("Command+Shift+N"),
        "escape": if settings["escapeHidesPopover"].as_bool().unwrap_or(true) { "Escape" } else { "" },
        "metaModifier": meta_modifier,
        "activeProviderId": settings["activeProviderId"].as_str().unwrap_or("chatgpt"),
        "mode": mode,
    });
    format!(
        r#"(() => {{
          const bindings = {bindings};
          window.__justChatShortcutBindings = bindings;
          if (window.__justChatShortcutListener) return;
          window.__justChatShortcutListener = true;
          window.addEventListener('keydown', event => {{
            if (event.repeat || event.isComposing) return;
            const parts = [];
            if (event.altKey) parts.push('Alt');
            if (event.ctrlKey) parts.push('Control');
            if (event.metaKey) parts.push(window.__justChatShortcutBindings.metaModifier);
            if (event.shiftKey) parts.push('Shift');
            let key = event.code === 'Space' ? 'Space' : event.code === 'Comma' ? 'Comma' : event.code === 'Period' ? 'Period' : /^Key[A-Z]$/.test(event.code) ? event.code.slice(-1) : /^Digit[0-9]$/.test(event.code) ? event.code.slice(-1) : event.key;
            if (/^[a-z]$/.test(key)) key = key.toUpperCase();
            const chord = parts.concat(key).join('+');
            const shortcuts = window.__justChatShortcutBindings;
            const zoomModifier = !event.altKey && (shortcuts.metaModifier === 'Command' ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey);
            const zoomKey = ['Digit0','Numpad0','Minus','NumpadSubtract','Equal','NumpadAdd'].includes(event.code) || ['-','_','+','='].includes(event.key);
            if (zoomModifier && zoomKey) {{ event.preventDefault(); event.stopImmediatePropagation(); return; }}
            if (event.key === 'Escape' && shortcuts.mode !== 'fullscreen' && !shortcuts.escape) return;
            if (shortcuts.activeProviderId === 'chatgpt' && event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {{
              setTimeout(() => {{ location.href = 'justchat://shortcut?chord=__chatgpt-send__'; }}, 40);
            }}
            if (![shortcuts.settings, shortcuts.hide, shortcuts.size, shortcuts.fullscreen, shortcuts.temporaryChat, shortcuts.escape].includes(chord)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            location.href = 'justchat://shortcut?chord=' + encodeURIComponent(chord);
          }}, true);
        }})()"#,
        bindings = bindings
    )
}

fn default_settings() -> Value {
    let (toggle, temporary_chat, toggle_size, toggle_fullscreen, chatgpt_provider, claude_provider) =
        if cfg!(target_os = "macos") {
            (
                "Alt+Space",
                "Command+Shift+N",
                "Command+Shift+E",
                "Command+Shift+F",
                "Alt+1",
                "Alt+2",
            )
        } else {
            (
                "Control+Shift+Space",
                "Control+Shift+N",
                "Control+Shift+E",
                "Control+Shift+F",
                "Control+Shift+1",
                "Control+Shift+2",
            )
        };
    json!({
        "activeProviderId": "chatgpt",
        "shortcuts": {
            "toggle": toggle,
            "temporaryChat": temporary_chat,
            "toggleSize": toggle_size,
            "toggleFullscreen": toggle_fullscreen,
            "providers": { "chatgpt": chatgpt_provider, "claude": claude_provider }
        },
        "alwaysOnTop": true,
        "autoHidePopover": false,
        "escapeHidesPopover": true,
        "opacity": 1,
        "theme": "system",
        "opacityMode": "window",
        "backgroundOpacity": 0.9,
        "pageZoomPercent": 100,
        "pageZoomScaleVersion": 3,
        "notifyWhenChatGPTCompletesWhileHidden": true,
        "resetAfterMinutes": 30,
        "geometry": {},
        "geometryByDisplay": {}
    })
}

fn normalize_shortcut(raw: &str) -> Option<String> {
    let mut modifiers = Vec::new();
    let mut keys = Vec::new();
    for part in raw.split('+').map(str::trim) {
        let modifier = match part.to_ascii_lowercase().as_str() {
            "alt" => Some("Alt"),
            "control" => Some("Control"),
            "command" => Some("Command"),
            "shift" => Some("Shift"),
            "super" => Some("Super"),
            _ => None,
        };
        if let Some(modifier) = modifier {
            modifiers.push(modifier);
        } else {
            keys.push(part);
        }
    }
    if modifiers.is_empty()
        || keys.len() != 1
        || modifiers.len()
            != modifiers
                .iter()
                .collect::<std::collections::HashSet<_>>()
                .len()
    {
        return None;
    }
    let raw_key = keys[0];
    let key = match raw_key.to_ascii_lowercase().as_str() {
        "space" => "Space".to_string(),
        "enter" => "Enter".to_string(),
        "tab" => "Tab".to_string(),
        "escape" => "Escape".to_string(),
        "backspace" => "Backspace".to_string(),
        "delete" => "Delete".to_string(),
        "insert" => "Insert".to_string(),
        "home" => "Home".to_string(),
        "end" => "End".to_string(),
        "pageup" => "PageUp".to_string(),
        "pagedown" => "PageDown".to_string(),
        "up" => "Up".to_string(),
        "down" => "Down".to_string(),
        "left" => "Left".to_string(),
        "right" => "Right".to_string(),
        "plus" => "Plus".to_string(),
        "comma" => "Comma".to_string(),
        "period" => "Period".to_string(),
        _ if raw_key.len() == 1 && raw_key.chars().all(|ch| ch.is_ascii_alphanumeric()) => {
            raw_key.to_ascii_uppercase()
        }
        _ if raw_key.len() >= 2
            && raw_key.len() <= 3
            && raw_key.starts_with('F')
            && raw_key[1..]
                .parse::<u8>()
                .is_ok_and(|n| (1..=24).contains(&n)) =>
        {
            raw_key.to_ascii_uppercase()
        }
        _ => return None,
    };
    let order = ["Alt", "Control", "Command", "Shift", "Super"];
    modifiers.sort_by_key(|modifier| {
        order
            .iter()
            .position(|item| item == modifier)
            .unwrap_or(usize::MAX)
    });
    Some(
        modifiers
            .into_iter()
            .chain(std::iter::once(key.as_str()))
            .collect::<Vec<_>>()
            .join("+"),
    )
}

fn validate_shortcuts(settings: &Value) -> Vec<String> {
    let entries = [
        ("toggle", &settings["shortcuts"]["toggle"]),
        ("temporary-chat", &settings["shortcuts"]["temporaryChat"]),
        ("toggle-size", &settings["shortcuts"]["toggleSize"]),
        (
            "toggle-fullscreen",
            &settings["shortcuts"]["toggleFullscreen"],
        ),
        (
            "provider:chatgpt",
            &settings["shortcuts"]["providers"]["chatgpt"],
        ),
        (
            "provider:claude",
            &settings["shortcuts"]["providers"]["claude"],
        ),
    ];
    let mut seen = HashMap::<String, &str>::new();
    let mut failures = Vec::new();
    for (name, value) in entries {
        let Some(raw) = value.as_str() else {
            failures.push(format!("{name}:invalid"));
            continue;
        };
        let Some(normalized) = normalize_shortcut(raw) else {
            failures.push(format!("{name}:invalid"));
            continue;
        };
        let canonical = normalized.to_ascii_lowercase();
        if let Some(previous) = seen.get(&canonical) {
            failures.push(format!("{name}:duplicate:{previous}"));
        } else {
            seen.insert(canonical, name);
        }
        if cfg!(target_os = "macos") && normalized == "Command+Shift+S" {
            failures.push(format!("{name}:reserved:chatgpt-sidebar"));
        }
    }
    failures
}

fn merge_json(target: &mut Value, patch: &Value) {
    if let (Some(target), Some(patch)) = (target.as_object_mut(), patch.as_object()) {
        for (key, value) in patch {
            if value.is_object() && target.get(key).is_some_and(Value::is_object) {
                merge_json(target.get_mut(key).expect("key exists"), value);
            } else {
                target.insert(key.clone(), value.clone());
            }
        }
    }
}

fn emit_state(app: &AppHandle, runtime: &Runtime) {
    let snapshot = runtime
        .state
        .lock()
        .expect("runtime state poisoned")
        .clone();
    if let Some(shell) = runtime.shell.lock().expect("shell lock poisoned").as_ref() {
        let _ = shell.emit("shell-state", snapshot);
    }
    let _ = app;
}

fn apply_layout(runtime: &Runtime) {
    let window = runtime.window.lock().expect("window lock poisoned").clone();
    let shell = runtime.shell.lock().expect("shell lock poisoned").clone();
    let provider = runtime
        .provider
        .lock()
        .expect("provider lock poisoned")
        .clone();
    let (Some(window), Some(shell), Some(provider)) = (window, shell, provider) else {
        return;
    };
    let state = runtime
        .state
        .lock()
        .expect("runtime state poisoned")
        .clone();
    let scale = window.scale_factor().unwrap_or(1.0);
    let size = match window.inner_size() {
        Ok(size) => size.to_logical::<f64>(scale),
        Err(_) => return,
    };

    if state.settings_visible {
        let _ = shell.set_position(LogicalPosition::new(0.0, 0.0));
        let _ = shell.set_size(LogicalSize::new(size.width, size.height));
    } else {
        let _ = provider.set_position(LogicalPosition::new(0.0, HEADER_HEIGHT));
        let _ = provider.set_size(LogicalSize::new(
            size.width,
            (size.height - HEADER_HEIGHT).max(1.0),
        ));
        let _ = shell.set_position(LogicalPosition::new(0.0, 0.0));
        let _ = shell.set_size(LogicalSize::new(size.width, HEADER_HEIGHT));
    }
    let _ = provider.eval(provider_shortcut_script(&state.settings, &state.mode));
}

fn animate_window_frame(
    window: &Window,
    target_position: PhysicalPosition<i32>,
    target_size: PhysicalSize<u32>,
    runtime: &Runtime,
) {
    let (Ok(start_position), Ok(start_size)) = (window.outer_position(), window.inner_size())
    else {
        let _ = window.set_position(target_position);
        let _ = window.set_size(target_size);
        return;
    };
    let transition_id = runtime.transition_id.fetch_add(1, Ordering::Relaxed) + 1;
    let window = window.clone();
    let transition_counter = runtime.transition_id.clone();
    thread::spawn(move || {
        const FRAMES: u32 = 12;
        for frame in 1..=FRAMES {
            if transition_counter.load(Ordering::Relaxed) != transition_id {
                return;
            }
            let progress = frame as f64 / FRAMES as f64;
            let eased = 1.0 - (1.0 - progress).powi(3);
            let position = PhysicalPosition::new(
                (start_position.x as f64 + (target_position.x - start_position.x) as f64 * eased)
                    .round() as i32,
                (start_position.y as f64 + (target_position.y - start_position.y) as f64 * eased)
                    .round() as i32,
            );
            let size = PhysicalSize::new(
                (start_size.width as f64
                    + (target_size.width as f64 - start_size.width as f64) * eased)
                    .round() as u32,
                (start_size.height as f64
                    + (target_size.height as f64 - start_size.height as f64) * eased)
                    .round() as u32,
            );
            let _ = window.set_size(size);
            let _ = window.set_position(position);
            thread::sleep(Duration::from_millis(16));
        }
        if transition_counter.load(Ordering::Relaxed) != transition_id {
            return;
        }
        let _ = window.set_size(target_size);
        let _ = window.set_position(target_position);
    });
}

fn animate_to_mode(window: &Window, width: f64, height: f64, runtime: &Runtime) {
    let (Ok(position), Ok(size), Ok(scale)) = (
        window.outer_position(),
        window.inner_size(),
        window.scale_factor(),
    ) else {
        let _ = window.set_size(LogicalSize::new(width, height));
        return;
    };
    let current = size.to_logical::<f64>(scale);
    let target_width = width;
    let x = position.x + ((current.width - target_width) * scale / 2.0).round() as i32;
    let y = position.y + ((current.height - height) * scale).round() as i32;
    animate_window_frame(
        window,
        PhysicalPosition::new(x, y),
        PhysicalSize::new(
            (target_width * scale).round() as u32,
            (height * scale).round() as u32,
        ),
        runtime,
    );
}

#[cfg(target_os = "macos")]
#[allow(unexpected_cfgs)]
fn round_native_window(shell: &Webview, radius: f64) {
    let _ = shell.with_webview(move |webview| unsafe {
        use objc::{class, msg_send, sel, sel_impl};

        let window = webview.ns_window() as *mut objc::runtime::Object;
        if window.is_null() {
            return;
        }
        let _: () = msg_send![window, setOpaque: false];
        let clear: *mut objc::runtime::Object = msg_send![class!(NSColor), clearColor];
        let _: () = msg_send![window, setBackgroundColor: clear];
        let content: *mut objc::runtime::Object = msg_send![window, contentView];
        let _: () = msg_send![content, setWantsLayer: true];
        let layer: *mut objc::runtime::Object = msg_send![content, layer];
        let _: () = msg_send![layer, setCornerRadius: radius];
        let _: () = msg_send![layer, setMasksToBounds: true];
    });
}

#[cfg(target_os = "macos")]
#[allow(unexpected_cfgs)]
fn set_native_window_alpha(shell: &Webview, alpha: f64) {
    let _ = shell.with_webview(move |webview| unsafe {
        use objc::{msg_send, sel, sel_impl};

        let window = webview.ns_window() as *mut objc::runtime::Object;
        if !window.is_null() {
            let _: () = msg_send![window, setAlphaValue: alpha.clamp(0.6, 1.0)];
        }
    });
}

#[cfg(not(target_os = "macos"))]
fn set_native_window_alpha(_shell: &Webview, _alpha: f64) {}

#[cfg(target_os = "macos")]
#[allow(unexpected_cfgs)]
fn set_provider_native_transparency(provider: &Webview, transparent: bool) {
    let _ = provider.with_webview(move |webview| unsafe {
        use objc::{class, msg_send, sel, sel_impl};

        let view = webview.inner() as *mut objc::runtime::Object;
        if view.is_null() {
            return;
        }
        let _: () = msg_send![view, setOpaque: !transparent];
        let clear: *mut objc::runtime::Object = msg_send![class!(NSColor), clearColor];
        let selector = sel!(setUnderPageBackgroundColor:);
        let supports_under_page_background: bool = msg_send![view, respondsToSelector: selector];
        if supports_under_page_background {
            let _: () = msg_send![view, setUnderPageBackgroundColor: clear];
        }
    });
}

#[cfg(not(target_os = "macos"))]
fn set_provider_native_transparency(_provider: &Webview, _transparent: bool) {}

fn provider_appearance_script(settings: &Value, provider_id: &str) -> String {
    let enabled = settings["opacityMode"] == "background" && provider_id == "chatgpt";
    let alpha = settings["backgroundOpacity"]
        .as_f64()
        .unwrap_or(0.9)
        .clamp(0.7, 1.0);
    let theme = settings["theme"].as_str().unwrap_or("system");
    let alpha_css = format!("{:.0}%", alpha * 100.0);
    format!(
        r#"(() => {{
          const root = document.documentElement;
          const styleId = 'just-chat-tauri-background-opacity';
          let style = document.getElementById(styleId);
          if (!style) {{
            style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
              html[data-just-chat-tauri-bg] body,
              html[data-just-chat-tauri-bg] #thread,
              html[data-just-chat-tauri-bg] #root {{ background-color: transparent !important; }}
              html[data-just-chat-tauri-bg][data-theme="dark"] {{ --app-color-background-surface-under: color-mix(in srgb, #0d0d0d var(--just-chat-tauri-alpha), transparent); }}
              html[data-just-chat-tauri-bg][data-theme="light"] {{ --app-color-background-surface-under: color-mix(in srgb, #fff var(--just-chat-tauri-alpha), transparent); }}
              html[data-just-chat-tauri-bg] #thread,
              html[data-just-chat-tauri-bg] [data-testid="composer"] {{ background-color: color-mix(in srgb, var(--color-token-main-surface-primary, #212121) var(--just-chat-tauri-alpha), transparent) !important; }}
              html[data-just-chat-tauri-bg] .bg-token-main-surface-primary {{ background-color: color-mix(in srgb, var(--main-surface-primary, #212121) var(--just-chat-tauri-alpha), transparent) !important; }}
              html[data-just-chat-tauri-bg] .bg-token-bg-primary {{ background-color: color-mix(in srgb, var(--bg-primary, #212121) var(--just-chat-tauri-alpha), transparent) !important; }}
              html[data-just-chat-tauri-bg] .bg-token-bg-secondary {{ background-color: color-mix(in srgb, var(--bg-secondary, #303030) var(--just-chat-tauri-alpha), transparent) !important; }}
              html[data-just-chat-tauri-bg] .bg-token-bg-tertiary {{ background-color: color-mix(in srgb, var(--bg-tertiary, #424242) var(--just-chat-tauri-alpha), transparent) !important; }}
            `;
            (document.head || document.documentElement).appendChild(style);
          }}
          root.style.colorScheme = {theme:?};
          if ({enabled}) {{
            root.dataset.justChatTauriBg = 'true';
            root.style.setProperty('--just-chat-tauri-alpha', {alpha_css:?});
          }} else {{
            delete root.dataset.justChatTauriBg;
            root.style.removeProperty('--just-chat-tauri-alpha');
          }}
          return true;
        }})()"#
    )
}

fn apply_appearance(runtime: &Runtime) {
    let (window, shell, provider, state) = (
        runtime.window.lock().expect("window lock poisoned").clone(),
        runtime.shell.lock().expect("shell lock poisoned").clone(),
        runtime
            .provider
            .lock()
            .expect("provider lock poisoned")
            .clone(),
        runtime
            .state
            .lock()
            .expect("runtime state poisoned")
            .clone(),
    );
    let settings = state.settings;
    let Some(window) = window else { return };
    let theme = match settings["theme"].as_str().unwrap_or("system") {
        "dark" => Some(Theme::Dark),
        "light" => Some(Theme::Light),
        _ => None,
    };
    let _ = window.set_theme(theme);

    let opacity = if settings["opacityMode"] == "window" {
        settings["opacity"].as_f64().unwrap_or(1.0).clamp(0.6, 1.0)
    } else {
        1.0
    };
    if let Some(shell) = shell {
        set_native_window_alpha(&shell, opacity);
    }
    if let Some(provider) = provider {
        let selective = settings["opacityMode"] == "background" && state.provider_id == "chatgpt";
        set_provider_native_transparency(&provider, selective);
        let _ = provider.set_zoom(
            settings["pageZoomPercent"]
                .as_f64()
                .unwrap_or(100.0)
                .clamp(70.0, 120.0)
                * 0.996
                / 100.0,
        );
        let script = provider_appearance_script(&settings, &state.provider_id);
        let _ = provider.eval(script);
        let _ = provider.eval(provider_shortcut_script(&settings, &state.mode));
    }
}

fn apply_provider_appearance(provider: &Webview, runtime: &Runtime) {
    let state = runtime
        .state
        .lock()
        .expect("runtime state poisoned")
        .clone();
    let selective = state.settings["opacityMode"] == "background" && state.provider_id == "chatgpt";
    set_provider_native_transparency(provider, selective);
    let _ = provider.set_zoom(
        state.settings["pageZoomPercent"]
            .as_f64()
            .unwrap_or(100.0)
            .clamp(70.0, 120.0)
            * 0.996
            / 100.0,
    );
    let _ = provider.eval(provider_appearance_script(
        &state.settings,
        &state.provider_id,
    ));
    let _ = provider.eval(provider_shortcut_script(&state.settings, &state.mode));
}

#[cfg(not(target_os = "macos"))]
fn round_native_window(_shell: &Webview, _radius: f64) {}

fn focus_provider(runtime: &Runtime) {
    let provider = runtime
        .provider
        .lock()
        .expect("provider lock poisoned")
        .clone();
    if let Some(provider) = provider {
        let _ = provider.eval(
            "(() => { const selectors = ['#prompt-textarea','[data-testid=\"composer\"] [contenteditable=\"true\"]','form [contenteditable=\"true\"]','textarea']; let tries=0; const focus=()=>{ const target=selectors.map(s=>document.querySelector(s)).find(el=>el instanceof HTMLElement && el.getClientRects().length); if(target){target.focus({preventScroll:true}); return} if(++tries<30)setTimeout(focus,200); }; focus(); })()",
        );
    }
}

fn toggle_window(app: &AppHandle) {
    let runtime = app.state::<Runtime>();
    let window = { runtime.window.lock().expect("window lock poisoned").clone() };
    if let Some(window) = window {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let (mode, settings_visible) = {
                let mut state = runtime.state.lock().expect("runtime state poisoned");
                let conversation = state.provider_id == "chatgpt"
                    && state.settings["lastChatGPTConversationPath"]
                        .as_str()
                        .is_some();
                state.mode = if conversation { "expanded" } else { "compact" }.into();
                (state.mode.clone(), state.settings_visible)
            };
            let size = if settings_visible {
                (560.0, 680.0)
            } else if mode == "expanded" {
                (DEFAULT_WIDTH, EXPANDED_HEIGHT)
            } else {
                (DEFAULT_WIDTH, DEFAULT_HEIGHT)
            };
            animate_to_mode(&window, size.0, size.1, &runtime);
            apply_layout(&runtime);
            let _ = window.show();
            let _ = window.set_focus();
            if settings_visible {
                if let Some(shell) = runtime.shell.lock().expect("shell lock poisoned").as_ref() {
                    let _ = shell.set_focus();
                }
            } else {
                focus_provider(&runtime);
            }
        }
    }
}

#[tauri::command]
fn get_shell_state(runtime: tauri::State<'_, Runtime>) -> ShellState {
    runtime
        .state
        .lock()
        .expect("runtime state poisoned")
        .clone()
}

#[tauri::command]
fn hide_window(app: AppHandle, runtime: tauri::State<'_, Runtime>) {
    if let Some(window) = runtime
        .window
        .lock()
        .expect("window lock poisoned")
        .as_ref()
    {
        let _ = window.hide();
    }
    emit_state(&app, &runtime);
}

#[tauri::command]
fn set_mode(mode: String, app: AppHandle, runtime: tauri::State<'_, Runtime>) {
    let Some(window) = runtime.window.lock().expect("window lock poisoned").clone() else {
        return;
    };
    let (width, height) = match mode.as_str() {
        "expanded" => (DEFAULT_WIDTH, EXPANDED_HEIGHT),
        "popover" => (900.0, 600.0),
        _ => (DEFAULT_WIDTH, DEFAULT_HEIGHT),
    };
    if runtime.state.lock().expect("runtime state poisoned").mode == "fullscreen" {
        restore_fullscreen(&window, &runtime);
    }
    animate_to_mode(&window, width, height, &runtime);
    {
        let mut state = runtime.state.lock().expect("runtime state poisoned");
        state.mode = mode;
        state.settings_visible = false;
    }
    apply_layout(&runtime);
    emit_state(&app, &runtime);
    let _ = window.set_focus();
    focus_provider(&runtime);
}

#[tauri::command]
fn toggle_fullscreen(app: AppHandle, runtime: tauri::State<'_, Runtime>) {
    let Some(window) = runtime.window.lock().expect("window lock poisoned").clone() else {
        return;
    };
    toggle_fullscreen_inner(&window, &runtime);
    emit_state(&app, &runtime);
}

fn toggle_fullscreen_inner(window: &Window, runtime: &Runtime) {
    let is_fullscreen = runtime.state.lock().expect("runtime state poisoned").mode == "fullscreen";
    if is_fullscreen {
        restore_fullscreen(window, runtime);
        apply_layout(runtime);
        return;
    }
    let (Ok(position), Ok(size), Ok(Some(monitor))) = (
        window.outer_position(),
        window.inner_size(),
        window.current_monitor(),
    ) else {
        return;
    };
    let mode = runtime
        .state
        .lock()
        .expect("runtime state poisoned")
        .mode
        .clone();
    *runtime
        .fullscreen_restore
        .lock()
        .expect("fullscreen lock poisoned") = Some(FullscreenRestore {
        position,
        size,
        mode,
    });
    let area = monitor.work_area();
    animate_window_frame(window, area.position, area.size, runtime);
    runtime.state.lock().expect("runtime state poisoned").mode = "fullscreen".into();
    apply_layout(runtime);
}

fn fill_current_work_area(window: &Window, monitor: &tauri::Monitor) {
    let area = monitor.work_area();
    let _ = window.set_fullscreen(false);
    let _ = window.set_position(PhysicalPosition::new(area.position.x, area.position.y));
    let _ = window.set_size(PhysicalSize::new(area.size.width, area.size.height));
}

fn restore_fullscreen(window: &Window, runtime: &Runtime) {
    let previous = runtime
        .fullscreen_restore
        .lock()
        .expect("fullscreen lock poisoned")
        .take();
    if let Some(previous) = previous {
        animate_window_frame(window, previous.position, previous.size, runtime);
        runtime.state.lock().expect("runtime state poisoned").mode = previous.mode;
    } else {
        animate_to_mode(window, DEFAULT_WIDTH, DEFAULT_HEIGHT, runtime);
        runtime.state.lock().expect("runtime state poisoned").mode = "compact".into();
    }
}

fn dispatch_focused_shortcut(chord: &str, runtime: &Runtime) -> bool {
    let Some(window) = runtime.window.lock().expect("window lock poisoned").clone() else {
        return false;
    };
    if !window.is_visible().unwrap_or(false) {
        return false;
    }
    let state = runtime
        .state
        .lock()
        .expect("runtime state poisoned")
        .clone();
    let configured = |key: &str| state.settings["shortcuts"][key].as_str().unwrap_or("") == chord;
    if chord
        == if cfg!(target_os = "macos") {
            "Command+Comma"
        } else {
            "Control+Comma"
        }
    {
        apply_settings_visibility(!state.settings_visible, runtime);
    } else if cfg!(target_os = "macos") && chord == "Command+W" {
        if state.mode == "fullscreen" {
            toggle_fullscreen_inner(&window, runtime);
        } else {
            let _ = window.hide();
        }
    } else if chord == "Escape" {
        if state.settings_visible {
            apply_settings_visibility(false, runtime);
        } else if state.mode == "fullscreen" {
            toggle_fullscreen_inner(&window, runtime);
        } else if state.settings["escapeHidesPopover"]
            .as_bool()
            .unwrap_or(true)
        {
            let _ = window.hide();
        } else {
            return false;
        }
    } else if configured("toggleSize")
        && !state.settings_visible
        && ["compact", "expanded"].contains(&state.mode.as_str())
    {
        let (width, height, next_mode) = if state.mode == "compact" {
            (DEFAULT_WIDTH, EXPANDED_HEIGHT, "expanded")
        } else {
            (DEFAULT_WIDTH, DEFAULT_HEIGHT, "compact")
        };
        animate_to_mode(&window, width, height, runtime);
        runtime.state.lock().expect("runtime state poisoned").mode = next_mode.into();
        apply_layout(runtime);
    } else if configured("toggleFullscreen") && !state.settings_visible {
        toggle_fullscreen_inner(&window, runtime);
    } else if configured("temporaryChat")
        && state.provider_id == "chatgpt"
        && !state.settings_visible
        && ["compact", "expanded"].contains(&state.mode.as_str())
    {
        if let Some(provider) = runtime
            .provider
            .lock()
            .expect("provider lock poisoned")
            .as_ref()
        {
            run_temporary_chat_script(provider);
        }
    } else if chord == "__chatgpt-send__"
        && state.provider_id == "chatgpt"
        && state.mode == "compact"
        && !state.settings_visible
    {
        animate_to_mode(&window, DEFAULT_WIDTH, EXPANDED_HEIGHT, runtime);
        runtime.state.lock().expect("runtime state poisoned").mode = "expanded".into();
        apply_layout(runtime);
    } else {
        return false;
    }
    true
}

fn temporary_chat_automation_script() -> &'static str {
    const START: &str = "export const temporaryChatAutomationScript = String.raw`";
    include_str!("../../src/main/temporary-chat-automation.ts")
        .split_once(START)
        .and_then(|(_, rest)| rest.split_once('`').map(|(script, _)| script))
        .unwrap_or("location.href = 'https://chatgpt.com/?temporary-chat=true';")
}

fn run_temporary_chat_script(provider: &Webview) {
    let script = format!(
        "(async () => {{ const result = await ({}); const url = new URL(location.href); const fallbackCodes = ['temporary-chat-control-unavailable','new-chat-control-unavailable','new-chat-transition-not-confirmed','temporary-chat-state-lost']; if (fallbackCodes.includes(result?.code) && url.hostname === 'chatgpt.com' && !/^\\/g(?:\\/|$)/i.test(url.pathname)) location.href = 'https://chatgpt.com/?temporary-chat=true'; }})()",
        temporary_chat_automation_script()
    );
    let _ = provider.eval(script);
}

fn record_chatgpt_route(raw_url: &str, runtime: &Runtime) {
    let Ok(url) = raw_url.parse::<url::Url>() else {
        return;
    };
    if url.scheme() != "https:"
        || !matches!(url.host_str(), Some("chatgpt.com" | "www.chatgpt.com"))
    {
        return;
    }
    let path = url.path();
    let conversation = path
        .split('/')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    let route = if conversation.len() >= 2 && conversation[0] == "c" {
        Some(path.to_string())
    } else if url
        .query_pairs()
        .any(|(key, value)| key == "temporary-chat" && value == "true")
    {
        return;
    } else {
        None
    };
    let Ok(mut state) = runtime.state.lock() else {
        return;
    };
    if state.provider_id != "chatgpt"
        || state.settings["lastChatGPTConversationPath"].as_str() == route.as_deref()
    {
        return;
    }
    match route {
        Some(path) => state.settings["lastChatGPTConversationPath"] = Value::String(path),
        None => {
            if let Some(settings) = state.settings.as_object_mut() {
                settings.remove("lastChatGPTConversationPath");
            }
        }
    }
    let serialized = serde_json::to_vec_pretty(&state.settings).unwrap_or_default();
    drop(state);
    if let Some(path) = runtime
        .settings_path
        .lock()
        .ok()
        .and_then(|path| path.clone())
    {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(path, serialized);
    }
}

fn apply_settings_visibility(visible: bool, runtime: &Runtime) {
    let (current_visibility, mode) = {
        let state = runtime.state.lock().expect("runtime state poisoned");
        (state.settings_visible, state.mode.clone())
    };
    if current_visibility == visible {
        return;
    }
    let window = runtime
        .window
        .lock()
        .expect("window lock poisoned")
        .as_ref()
        .cloned();
    if visible {
        if let Some(window) = &window {
            if let (Ok(position), Ok(size)) = (window.outer_position(), window.inner_size()) {
                *runtime
                    .settings_restore
                    .lock()
                    .expect("settings restore lock poisoned") = Some(FullscreenRestore {
                    position,
                    size,
                    mode: mode.clone(),
                });
            }
        }
    }
    runtime
        .state
        .lock()
        .expect("runtime state poisoned")
        .settings_visible = visible;
    if let Some(window) = window {
        if visible {
            animate_to_mode(&window, 560.0, 680.0, runtime);
        } else if let Some(previous) = runtime
            .settings_restore
            .lock()
            .expect("settings restore lock poisoned")
            .take()
        {
            animate_window_frame(&window, previous.position, previous.size, runtime);
        } else if mode == "fullscreen" {
            if let Ok(Some(monitor)) = window.current_monitor() {
                let area = monitor.work_area();
                animate_window_frame(&window, area.position, area.size, runtime);
            }
        } else {
            let (width, height) = if mode == "expanded" {
                (DEFAULT_WIDTH, EXPANDED_HEIGHT)
            } else {
                (DEFAULT_WIDTH, DEFAULT_HEIGHT)
            };
            animate_to_mode(&window, width, height, runtime);
        }
    }
    apply_layout(runtime);
    if visible {
        if let Some(shell) = runtime.shell.lock().expect("shell lock poisoned").as_ref() {
            let _ = shell.set_focus();
        }
    } else {
        focus_provider(runtime);
    }
}

#[tauri::command]
fn dispatch_shortcut(
    chord: String,
    webview: Webview,
    app: AppHandle,
    runtime: tauri::State<'_, Runtime>,
) -> bool {
    if webview.label() != "shell" {
        return false;
    }
    let handled = dispatch_focused_shortcut(&chord, &runtime);
    if handled {
        emit_state(&app, &runtime);
    }
    handled
}

#[tauri::command]
fn set_settings_visible(visible: bool, app: AppHandle, runtime: tauri::State<'_, Runtime>) {
    apply_settings_visibility(visible, &runtime);
    emit_state(&app, &runtime);
}

#[tauri::command]
fn start_dragging(runtime: tauri::State<'_, Runtime>) {
    if let Some(window) = runtime
        .window
        .lock()
        .expect("window lock poisoned")
        .as_ref()
    {
        let _ = window.start_dragging();
    }
}

#[tauri::command]
fn select_provider(
    provider: String,
    app: AppHandle,
    runtime: tauri::State<'_, Runtime>,
) -> Result<(), String> {
    let url = match provider.as_str() {
        "chatgpt" => "https://chatgpt.com/",
        "claude" => "https://claude.ai/",
        _ => return Err("unsupported-provider".into()),
    };
    let webview = runtime
        .provider
        .lock()
        .expect("provider lock poisoned")
        .clone()
        .ok_or("provider-not-ready")?;
    webview
        .navigate(url.parse().map_err(|_| "invalid-provider-url")?)
        .map_err(|error| error.to_string())?;
    {
        let mut state = runtime.state.lock().expect("runtime state poisoned");
        state.provider_id = provider.clone();
        state.provider_state = "loading".into();
        state.settings["activeProviderId"] = Value::String(provider);
    }
    apply_appearance(&runtime);
    emit_state(&app, &runtime);
    Ok(())
}

#[tauri::command]
fn retry_provider(runtime: tauri::State<'_, Runtime>) {
    if let Some(provider) = runtime
        .provider
        .lock()
        .expect("provider lock poisoned")
        .as_ref()
    {
        let _ = provider.reload();
    }
}

#[tauri::command]
fn clear_chatgpt_session(runtime: tauri::State<'_, Runtime>) -> Value {
    let provider = runtime
        .provider
        .lock()
        .expect("provider lock poisoned")
        .clone();
    let Some(provider) = provider else {
        return json!({ "ok": false, "cleared": false, "reason": "provider-not-ready" });
    };
    if let Err(error) = provider.clear_all_browsing_data() {
        return json!({ "ok": false, "cleared": false, "reason": error.to_string() });
    }
    let _ = provider.navigate("https://chatgpt.com/".parse().expect("valid ChatGPT URL"));
    {
        let mut state = runtime.state.lock().expect("runtime state poisoned");
        state.provider_id = "chatgpt".into();
        state.provider_state = "loading".into();
        state.settings["activeProviderId"] = Value::String("chatgpt".into());
    }
    json!({ "ok": true, "cleared": true })
}

#[tauri::command]
fn update_settings(patch: Value, app: AppHandle, runtime: tauri::State<'_, Runtime>) -> Value {
    let old_shortcut;
    let new_shortcut;
    let next_settings;
    {
        let state = runtime.state.lock().expect("runtime state poisoned");
        old_shortcut = state.settings["shortcuts"]["toggle"]
            .as_str()
            .unwrap_or("Alt+Space")
            .to_string();
        let mut candidate = state.settings.clone();
        merge_json(&mut candidate, &patch);
        new_shortcut = candidate["shortcuts"]["toggle"]
            .as_str()
            .unwrap_or("Alt+Space")
            .to_string();
        next_settings = candidate;
    }

    if patch.get("shortcuts").is_some() {
        let failures = validate_shortcuts(&next_settings);
        if !failures.is_empty() {
            return json!({ "ok": false, "failures": failures });
        }
    }

    if old_shortcut != new_shortcut {
        let shortcuts = app.global_shortcut();
        let _ = shortcuts.unregister(old_shortcut.as_str());
        if let Err(error) = shortcuts.register(new_shortcut.as_str()) {
            let _ = shortcuts.register(old_shortcut.as_str());
            return json!({ "ok": false, "failures": [format!("toggle:{}", error)] });
        }
    }

    {
        let mut state = runtime.state.lock().expect("runtime state poisoned");
        state.settings = next_settings.clone();
        if patch.get("shortcuts").is_some() {
            state.shortcut_failures.clear();
        }
    }
    if let Some(path) = runtime
        .settings_path
        .lock()
        .expect("settings path poisoned")
        .as_ref()
    {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(
            path,
            serde_json::to_vec_pretty(&next_settings).unwrap_or_default(),
        );
    }
    if let Some(window) = runtime
        .window
        .lock()
        .expect("window lock poisoned")
        .as_ref()
    {
        if let Some(always_on_top) = next_settings["alwaysOnTop"].as_bool() {
            let _ = window.set_always_on_top(always_on_top);
        }
    }
    apply_appearance(&runtime);
    emit_state(&app, &runtime);
    json!({ "ok": true, "settings": next_settings })
}

fn load_settings(path: &PathBuf) -> Value {
    let mut settings = default_settings();
    if let Ok(contents) = fs::read_to_string(path) {
        if let Ok(saved) = serde_json::from_str::<Value>(&contents) {
            merge_json(&mut settings, &saved);
        }
    }
    settings
}

fn main() {
    tauri::Builder::default()
        .manage(Runtime::default())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event: ShortcutEvent| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_window(app);
                    }
                })
                .build(),
        )
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "hide-window" {
                let runtime = app.state::<Runtime>();
                if dispatch_focused_shortcut("Command+W", &runtime) {
                    emit_state(app, &runtime);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_shell_state,
            hide_window,
            set_mode,
            toggle_fullscreen,
            set_settings_visible,
            start_dragging,
            select_provider,
            retry_provider,
            clear_chatgpt_session,
            dispatch_shortcut,
            update_settings
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let hide_item = MenuItem::with_id(
                    app,
                    "hide-window",
                    "Hide Just Chat",
                    true,
                    Some("CmdOrCtrl+W"),
                )?;
                let app_menu = Submenu::with_items(app, "Just Chat", true, &[&hide_item])?;
                // Replacing Tauri's default macOS menu with only the app menu also
                // removes the native Edit actions that WKWebView relies on for
                // standard Command+C/V/X/A editing commands.
                let undo_item = PredefinedMenuItem::undo(app, None)?;
                let redo_item = PredefinedMenuItem::redo(app, None)?;
                let separator = PredefinedMenuItem::separator(app)?;
                let cut_item = PredefinedMenuItem::cut(app, None)?;
                let copy_item = PredefinedMenuItem::copy(app, None)?;
                let paste_item = PredefinedMenuItem::paste(app, None)?;
                let select_all_item = PredefinedMenuItem::select_all(app, None)?;
                let edit_menu = Submenu::with_items(
                    app,
                    "Edit",
                    true,
                    &[
                        &undo_item,
                        &redo_item,
                        &separator,
                        &cut_item,
                        &copy_item,
                        &paste_item,
                        &select_all_item,
                    ],
                )?;
                let menu = Menu::with_items(app, &[&app_menu, &edit_menu])?;
                app.set_menu(menu)?;
            }
            let runtime = app.state::<Runtime>();
            let settings_path = app.path().app_data_dir()?.join("settings.json");
            let settings = load_settings(&settings_path);
            {
                let mut state = runtime.state.lock().expect("runtime state poisoned");
                state.settings = settings;
            }
            *runtime
                .settings_path
                .lock()
                .expect("settings path poisoned") = Some(settings_path);

            let window = Window::builder(app, "main")
                .title("Just Chat")
                .inner_size(DEFAULT_WIDTH, DEFAULT_HEIGHT)
                .min_inner_size(480.0, 180.0)
                .resizable(true)
                .decorations(false)
                .transparent(true)
                .background_color(Color(0, 0, 0, 0))
                .shadow(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .visible(false)
                .build()?;

            let provider_app = app.handle().clone();
            let provider = window.add_child(
                tauri::webview::WebviewBuilder::new(
                    "provider",
                    WebviewUrl::External(
                        "https://chatgpt.com/".parse().expect("valid provider URL"),
                    ),
                )
                .on_new_window({
                    let popup_app = app.handle().clone();
                    move |url, features| {
                        // ChatGPT starts sign-in in a target=_blank window. Electron
                        // embeds these identity-provider popups in the same session;
                        // without this handler WKWebView drops the click with no UI.
                        if !is_allowed_chatgpt_auth_popup(&url) {
                            return NewWindowResponse::Deny;
                        }
                        let label = format!(
                            "chatgpt-auth-{}",
                            NEXT_AUTH_POPUP_ID.fetch_add(1, Ordering::Relaxed)
                        );
                        match WebviewWindowBuilder::new(
                            &popup_app,
                            label,
                            WebviewUrl::External(url),
                        )
                        .window_features(features)
                        .title("Sign in to ChatGPT")
                        .on_navigation(move |target| {
                            is_allowed_chatgpt_auth_popup(target)
                        })
                        .build()
                        {
                            Ok(window) => NewWindowResponse::Create { window },
                            Err(error) => {
                                eprintln!("Could not open ChatGPT sign-in popup: {error}");
                                NewWindowResponse::Deny
                            }
                        }
                    }
                })
                .on_navigation({
                    let provider_app = app.handle().clone();
                    move |url| {
                        if url.scheme() == "justchat" {
                            if let Some(chord) = url.query_pairs().find_map(|(key, value)| (key == "chord").then(|| value.into_owned())) {
                                let runtime = provider_app.state::<Runtime>();
                                if dispatch_focused_shortcut(&chord, &runtime) { emit_state(&provider_app, &runtime); }
                            }
                            false
                        } else {
                            record_chatgpt_route(url.as_str(), &provider_app.state::<Runtime>());
                            true
                        }
                    }
                })
                .on_page_load(move |webview, payload| {
                    if payload.event() != PageLoadEvent::Finished {
                        return;
                    }
                    let runtime = provider_app.state::<Runtime>();
                    apply_provider_appearance(&webview, &runtime);
                    let _ = webview.eval("if (new URL(location.href).searchParams.get('temporary-chat') === 'true') setTimeout(() => { const input = document.querySelector('#prompt-textarea, [data-testid=\"composer\"] [contenteditable=\"true\"], [contenteditable=\"true\"], textarea'); input?.focus(); }, 250);");
                    runtime
                        .state
                        .lock()
                        .expect("runtime state poisoned")
                        .provider_state = "ready".into();
                    emit_state(&provider_app, &runtime);
                }),
                LogicalPosition::new(0.0, HEADER_HEIGHT),
                LogicalSize::new(DEFAULT_WIDTH, DEFAULT_HEIGHT - HEADER_HEIGHT),
            )?;
            let shell = window.add_child(
                tauri::webview::WebviewBuilder::new("shell", WebviewUrl::App("tauri.html".into())),
                LogicalPosition::new(0.0, 0.0),
                LogicalSize::new(DEFAULT_WIDTH, HEADER_HEIGHT),
            )?;

            *runtime.window.lock().expect("window lock poisoned") = Some(window.clone());
            *runtime.provider.lock().expect("provider lock poisoned") = Some(provider);
            round_native_window(&shell, 14.0);
            *runtime.shell.lock().expect("shell lock poisoned") = Some(shell);
            apply_appearance(&runtime);

            let resize_app = app.handle().clone();
            window.on_window_event(move |event| {
                if matches!(event, WindowEvent::Resized(_)) {
                    apply_layout(&resize_app.state::<Runtime>());
                }
            });

            let shortcut = runtime
                .state
                .lock()
                .expect("runtime state poisoned")
                .settings["shortcuts"]["toggle"]
                .as_str()
                .unwrap_or(if cfg!(target_os = "macos") { "Alt+Space" } else { "Control+Shift+Space" })
                .to_string();
            {
                let failures = validate_shortcuts(&runtime.state.lock().expect("runtime state poisoned").settings);
                runtime.state.lock().expect("runtime state poisoned").shortcut_failures = failures;
            }
            let startup_failures = runtime
                .state
                .lock()
                .expect("runtime state poisoned")
                .shortcut_failures
                .clone();
            if startup_failures.is_empty() {
                if let Err(error) = app.global_shortcut().register(shortcut.as_str()) {
                    runtime
                        .state
                        .lock()
                        .expect("runtime state poisoned")
                        .shortcut_failures
                        .push(format!("toggle:{error}"));
                }
            }

            apply_layout(&runtime);
            let _ = window.show();
            let _ = window.set_focus();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Just Chat Tauri");
}
