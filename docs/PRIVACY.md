# ContextForge — Privacy Policy

*Last updated: May 2026*

## Summary
ContextForge is a **local-first** browser extension. Your conversation data never
leaves your device except for two explicitly opt-in network calls described below.

---

## What data we collect

**We collect nothing.** ContextForge has no servers, no analytics, no telemetry,
and no accounts.

All data the extension reads or generates is stored exclusively in your browser's
local IndexedDB storage on your own machine.

---

## What the extension reads

When you click **Capture**, ContextForge reads the text content of the AI
conversation currently visible in your browser tab. This text is:

- Stored locally in IndexedDB on your device
- Never transmitted to any ContextForge server (there is none)
- Only sent to the Anthropic API if you have configured your own API key (see below)

---

## Network requests

ContextForge makes exactly two types of outbound network requests:

### 1. Anthropic API (optional, your key)
- **When:** Only when you enter your own Anthropic API key in Settings and click
  Capture. Without a key the extension works in "raw mode" with no API calls.
- **What is sent:** The text of the conversation you explicitly captured.
- **Who receives it:** Anthropic, under your own API account and their
  [Privacy Policy](https://www.anthropic.com/legal/privacy).
- **We never see it:** The request goes directly from your browser to Anthropic.

### 2. HuggingFace CDN (one-time, model weights only)
- **When:** The first time you use the search feature. Never again after that.
- **What is sent:** A standard HTTP GET request for a pre-trained sentence
  embedding model file (~22 MB). No conversation data is included.
- **Who receives it:** HuggingFace, under their
  [Privacy Policy](https://huggingface.co/privacy).
- **After the first download:** The model is cached by your browser and the CDN
  is never contacted again.

---

## Data storage

All capsules (captured conversations), version history, provenance records, and
search embeddings are stored in **your browser's IndexedDB** under the extension's
origin. This data:

- Never leaves your device
- Is deleted if you uninstall the extension or clear browser storage
- Is not backed up or synced by ContextForge

Your Anthropic API key is stored in `chrome.storage.local` (encrypted by Chrome,
local only, never synced to Google servers).

---

## Permissions explained

| Permission | Why |
|---|---|
| `storage` | Save capsules and settings to IndexedDB / chrome.storage |
| `tabs` | Read the current tab's URL to detect which AI platform you're on |
| `offscreen` | Run the embedding model in a background page |
| `alarms` | Keep the service worker alive during long API calls |
| Host permissions (claude.ai, chatgpt.com, etc.) | Read conversation text from those pages when you click Capture |

---

## Children's privacy
This extension is not directed at children under 13. We do not knowingly collect
any data from anyone.

## Changes to this policy
If we change how the extension handles data, we will update this document and
bump the extension version. Continued use after an update constitutes acceptance.

## Contact
Questions? Open an issue at the project repository or email sakar.joshi1601@gmail.com.
