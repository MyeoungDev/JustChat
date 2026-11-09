# Just Chat

**Quick ChatGPT for your desktop.**

Open a compact ChatGPT window with a shortcut, ask a question, then keep talking in a larger view. Just Chat is built with Electron for macOS and Windows and uses ChatGPT's website and your ChatGPT account.

<p align="center">
  <img src="docs/artifacts/readme/quick-chat-demo.gif" alt="A compact Just Chat window accepts a prompt and expands to show the ChatGPT response" width="720" />
</p>

## Why I built it

I used GPT Classic for its quick, lightweight chat window. As it became heavier and support was expected to end, I wanted to keep that fast way of reaching ChatGPT and make it available on both macOS and Windows.

## What it does

- **Quick Chat:** Open a small, always-on-top window from anywhere. It appears on the display under your pointer and focuses the message box.
- **Room to talk:** The empty window stays compact and grows when a conversation starts. Switch between Quick Chat and a larger view, or fill the current display.
- **Keyboard controls:** Use ChatGPT's own search shortcut, start a temporary chat, adjust the window, and open Settings from the keyboard.
- **Appearance:** Follow the system theme or choose Light or Dark. Adjust window opacity and ChatGPT page zoom in Settings.
- **Keep your place:** The app remembers your window size and ChatGPT session. An empty Quick Chat hides when you switch to another app.

### Shortcuts

| Action | macOS | Windows | Scope |
|---|---|---|---|
| Show or hide Just Chat | `Option+Space` | `Ctrl+Shift+Space` | Global |
| Quick Chat / larger view | `Command+Shift+E` | `Ctrl+Shift+E` | Just Chat focused |
| Fill / restore display | `Command+Shift+F` | `Ctrl+Shift+F` | Just Chat focused |
| Open Settings | `Command+,` | `Ctrl+,` | Just Chat focused |
| Start a temporary chat | `Command+Shift+N` | `Ctrl+Shift+N` | Just Chat focused |
| Search conversations | `Command+K` | `Ctrl+K` | ChatGPT built-in |
| Zoom ChatGPT page | `Command+-`, `Command++`, `Command+0` | `Ctrl+-`, `Ctrl++`, `Ctrl+0` | ChatGPT page |
| Hide Just Chat | `Escape` (`Command+W` also works) | `Escape` | Just Chat focused |

Only Show or Hide is global by default. Change app shortcuts in Settings. ChatGPT's `Command+K` / `Ctrl+K` search remains ChatGPT's own shortcut and is not remapped by Just Chat.

## Run from source

Prebuilt installers are not available yet. Run the development app locally:

```sh
git clone https://github.com/MyeoungDev/JustChat.git
cd JustChat
pnpm install
pnpm dev
```

### Requirements

- macOS or Windows
- Node.js 22.12 or newer
- pnpm 10 or newer

## Settings

Settings include:

- Global show/hide and focused window shortcuts
- System, Light, and Dark themes
- Always-on-top behavior, opacity, and ChatGPT page zoom
- Whether to reload ChatGPT after the window has been hidden for a while
- ChatGPT sign out and local website-data clearing

The default page zoom is calibrated to the previous full-size ChatGPT view. Temporary Chat is started through ChatGPT's own control when available.

## Limitations

- Just Chat is a desktop window around ChatGPT's website, not a separate ChatGPT client or model API.
- Sign-in, network challenges, and some interactions depend on ChatGPT and may change with its website.
- The ChatGPT integration is experimental. The app cannot guarantee that every website change will keep shortcuts and automatic window sizing working.
- Packaged installers, signing, and automatic updates are not available yet.

## Privacy

- ChatGPT signs in to a persistent website profile used only by Just Chat; it does not share cookies with Chrome or Safari.
- Just Chat does not copy conversation text into its settings. It stores the active conversation path so it can reopen the chat after a restart.
- Signing out in Settings clears Just Chat's local ChatGPT website data. It does not delete conversations from your ChatGPT account.

## Development checks

```sh
pnpm typecheck
pnpm test
pnpm build
```

More detail: [verification checklist](docs/verification.md), [security review](docs/SECURITY_REVIEW.md), and [architecture review](docs/architecture-review.md).

## License

[MIT](LICENSE)

## Not affiliated with OpenAI

Just Chat is an independent open-source project and is not affiliated with, endorsed by, or sponsored by OpenAI. ChatGPT is a trademark of OpenAI, used here only to identify the service Just Chat works with.
