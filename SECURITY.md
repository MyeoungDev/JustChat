# Security policy

## Supported versions

Security fixes are intended for the latest released version. Just Chat depends on Electron and the ChatGPT website; keep the app on a currently supported Electron release and report issues affecting the embedded website separately when appropriate.

## Reporting a vulnerability

Please do not publish exploit details in a public issue. Use GitHub's **Report a vulnerability** private reporting feature for this repository. Repository maintainers should enable private vulnerability reporting in GitHub's Security settings before distributing installers. If the private reporting button is unavailable, open a brief issue asking for a private contact method without including sensitive details.

Include the affected version, operating system, impact, and steps to reproduce. Remove account identifiers, prompts, replies, cookies, tokens, and private conversation URLs from reports and attachments.

## Release security

Current release artifacts are drafts for manual review. macOS uses an ad-hoc signature, which identifies no publisher and is not notarization; Windows has no publisher signature. Do not treat a draft as a trusted or officially supported installer. Report suspected artifact tampering privately and include the release tag and SHA-256 checksum; do not attach credentials or user data.
