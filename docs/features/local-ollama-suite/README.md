# Local Ollama suite

The local Ollama suite is an implementation package and accessible renderer surface for managing a local Ollama runtime. It is not yet connected to a shipped desktop application.

## Behaviour

The suite exposes five destinations:

1. **Model Store** — refreshes the exhaustive official Ollama library and tag inventory, searches it with plain text or an anchored regex builder, combines local installed/running state, and explains the evidence behind each hardware-fit verdict.
2. **Pull queue** — schedules local model downloads with storage preflight, bounded parallelism, progress, pause/resume/cancel/retry, durable partial outcomes, and restart reconciliation.
3. **Local chat** — streams responses from an explicitly chosen installed model, retains bounded local histories, validates parameters, and requires a reviewed acknowledgement before a message marked as containing tax data can be sent to the local model.
4. **Harnesses** — previews and launches committed allowlisted local profiles without a shell, after a configuration snapshot, with automatic rollback after failed readiness.
5. **Troubleshooter** — distinguishes healthy and unhealthy local API states, refines missing versus stopped when a privileged installation probe exists, and otherwise states the honest `missing-or-stopped` boundary. Bundled recovery guidance remains available offline.

The catalog may access only official `ollama.com` model and tag pages. Local runtime, generation, and chat traffic may access only loopback. Catalog requests never carry prompts, chat history, attachments, return content, taxpayer data, or identifiers.

## Configuration

Integrators provide bounded durable stores for the verified catalog, pull queue, chat history, and harness snapshots. They also provide privileged adapters for hardware facts, free storage, semantic folder selection, discovered executables, readiness, and installation detection. The default local API endpoint is `127.0.0.1:11434`; it cannot be changed to a non-loopback host.

Pull concurrency is clamped from one through four. Catalog tag-page concurrency is clamped from one through eight. Response, request, stream, line, history, prompt, attachment, page, and timeout limits are explicit package settings with hard ceilings.

## Failure modes

- The local service can be missing, stopped, unhealthy, or healthy. When the API alone cannot distinguish missing from stopped, the surface says so.
- An official catalog refresh can be fresh, incomplete, unavailable, or a stale cached fallback. Incomplete data never replaces the last complete cache.
- Hardware fit can be **Runs well**, **Runs with limits**, **Unlikely**, or **Unknown**. It is evidence, not a promise.
- A pull with unknown size, insufficient free space, invalid model reference, cancellation, or server failure records its exact outcome without turning the batch green.
- A chat with tax data is blocked until the user reviews the exact content and explicitly approves local model processing.
- A selected attachment is blocked when the local model does not report the required capability.
- A harness with an unapproved executable, argument, environment key, folder, file, or port is blocked before launch. Failed readiness triggers stop and rollback.

## Privacy and security

No cloud model service is present. No arbitrary URL, command, script, shell, proxy, account, purchase, subscription, or payment semantic is present. Secrets are excluded from harness arguments, snapshots, status, history, exports, and public records. Local model processing does not authorize electronic filing or government transmission; the paper-only manual-review boundary remains unchanged.

## Verification

No tests, lint, type checks, builds, runtime interaction, or captures were run during the ultra-speed implementation pass. No runtime, installer, or release claim is made.

## Suggested articles

- [Tax privacy and filing boundaries](../tax/privacy-and-filing-boundaries.md)
- [Tax data import and export](../tax/data-import-export.md)
- [Repository overview](../../../README.md)
