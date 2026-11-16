# Contributing

Thanks for considering a contribution to Just Chat.

## Before you start

- Open an issue to discuss larger changes before investing in implementation.
- Keep changes focused and explain user-visible behavior, testing, and platform limits in the pull request.
- Do not include account credentials, ChatGPT prompts or replies, cookies, private URLs, or personal data in code, screenshots, fixtures, or logs.
- Just Chat embeds the ChatGPT website. Avoid changes that imply affiliation with OpenAI or that bypass the service's authentication or access controls.

## Development

Requirements: Node.js 22.12 or newer and pnpm 11.4.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
```

For a local macOS Apple Silicon or Windows x64 package, use `pnpm dist:mac` or `pnpm dist:win` on the corresponding platform. Local packages are unsigned unless you configure your own signing environment; never commit signing files or credentials.

## Pull requests

- Describe the problem and the behavior changed.
- List the exact checks you ran and the OS/architecture used.
- Mark manual checks as pending when you could not perform them.
- Update README or `docs/` when support, privacy, security, or release behavior changes.
- Keep one pull request focused; do not combine unrelated formatting or generated files.
