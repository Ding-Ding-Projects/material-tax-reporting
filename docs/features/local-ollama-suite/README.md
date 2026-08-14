# Local Ollama suite

The local Ollama suite is an implementation package for managing a local Ollama runtime. It is not yet connected to a shipped desktop application, and it is not part of a released documentation site.

## A view-model, not a screen

The package builds and maintains one state object and one set of actions. It renders nothing: it creates no elements, owns no stylesheet, and does not compile against DOM types. Two hosts are expected to draw the same state inside their own shell — the documentation site surface and the desktop application surface — so behaviour is shared without a shared widget toolkit.

Colour, spacing and typography come from the host's tokens in `@material-tax-reporting/surface-kernel/tokens.css`. Search behaviour comes from the same kernel's single anchored search engine, so a pattern typed here behaves exactly as it does in every other search field in the repository.

## Behaviour

The state describes five destinations:

1. **Model store** — refreshes the exhaustive official Ollama library and tag inventory, combines local installed and running state, and explains the evidence behind each hardware-fit verdict. It is searched with plain text or a pattern; anchoring is provided by the shared builder's explicit **Start anchor** and **End anchor** tokens, so a person can anchor a pattern without typing regular-expression syntax. Family, capability and quantization facets are derived from the cached snapshot and narrow the visible variants.
2. **Pull queue** — schedules local model downloads with storage preflight, bounded parallelism, progress, pause, resume, cancel, retry, durable partial outcomes and restart reconciliation. A batch cart holds several reviewed variants, sums their sizes, applies the same temporary-file headroom the queue enforces, compares the total against measured free space, and states any shortfall in exact bytes before anything is queued.
3. **Local chat** — streams responses from an explicitly chosen installed model, retains a bounded local history, and requires a reviewed acknowledgement before a message marked as containing tax data can be sent. Image attachments are offered only when the selected model reports the image capability.
4. **Harnesses** — detects the allowed executables present on the computer, previews a launch, launches committed allowlisted profiles without a shell after taking a configuration snapshot, rolls back automatically when readiness fails, and restores any listed snapshot in one step.
5. **Troubleshooter** — carries one branch per runtime condition (`missing`, `stopped`, `missing-or-stopped`, `unhealthy`, `healthy`). The active branch names the exact local API checks that failed. Every branch carries a next step that can be followed with no network access, and no branch links to online documentation.

Every collection a host can filter — catalog variants, installed models, the queue, the chat history, harness profiles and harness snapshots — carries its own independent search state, so a host may attach one builder per collection.

## Guided choices

No selection in the suite is a free-form field.

- Harness executables are the ones detection actually found on the computer. When none are found the state says so explicitly and names the action that retries detection; a program path cannot be typed in.
- Chat and harness models are enumerated from the models the runtime reported as installed. An empty list names a recovery action rather than leaving a blank field.
- Catalog variants can only be queued or added to the cart if they came from the verified official catalog snapshot.
- A harness snapshot is restored by identifier resolved against the list the controller loaded. A caller-supplied restore payload is never accepted, and hosts receive snapshot identifiers, profile identifiers and timestamps only.

## Boundaries

The catalog may reach only official `ollama.com` model and tag pages. Local runtime, generation and chat traffic may reach only loopback at `127.0.0.1:11434`, and that host cannot be changed to a non-loopback address. Catalog requests never carry prompts, chat history, attachments, report content, taxpayer data or identifiers.

No project answer, report figure, attachment or vocabulary content reaches a model unless the user explicitly attaches or types it into a message. Nothing in this suite files, transmits or submits a return: there is no electronic submission, no direct transmission to a tax authority and no automatic filing anywhere in the package. The application boundary remains a mail-in PDF package that requires manual review.

The batch cart schedules local downloads only. There is no cost, no account and no commercial concept anywhere in the package, and an executable regression fails the suite if one is introduced.

## Configuration

Integrators provide bounded durable stores for the verified catalog, pull queue, chat history and harness snapshots. They also provide privileged adapters for hardware facts, free storage, semantic folder selection, discovered executables, readiness and installation detection.

Pull concurrency is clamped from one through four. Catalog tag-page concurrency is clamped from one through eight. Response, request, stream, line, history, prompt, attachment, page and timeout limits are explicit package settings with hard ceilings.

## Failure modes

- The local service can be missing, stopped, unhealthy or healthy. When the API alone cannot distinguish missing from stopped, the state says so instead of guessing.
- An official catalog refresh can be fresh, incomplete, unavailable or a stale cached fallback. Incomplete data never replaces the last complete cache.
- Hardware fit can be **Runs well**, **Runs with limits**, **Unlikely** or **Unknown**. A missing measurement produces **Unknown**, never a confident verdict.
- A batch that does not fit reports the exact byte shortfall and queues nothing at all.
- A pull with unknown size, insufficient free space, an invalid model reference, cancellation or a server failure records its exact outcome without turning the batch green.
- A chat with tax data is blocked until the user reviews the exact content and explicitly approves local model processing.
- An attachment is blocked when the local model does not report the required capability.
- A harness with an unapproved executable, argument, environment key, folder, file or port is blocked before launch. Failed readiness triggers stop and rollback.

## Verification

The following were run in this repository and their output observed:

- `tsc -p packages/local-ollama/tsconfig.json --noEmit` — no errors.
- `node --test --experimental-strip-types packages/local-ollama/test/*.test.ts` — 37 tests passed, 0 failed.
- `node --test --experimental-strip-types packages/local-coding-assistants/test/*.test.ts` — 6 tests passed, 0 failed.

The following were **not** run and no claim is made about them: lint, application builds, packaging, installers, releases, screenshots, accessibility conformance checks, performance measurement, and any interaction with a real Ollama service. No Ollama server was available in the environment where this change was written, so every test is driven by an injected double and no live runtime, model download or chat response was observed.

## Suggested articles

- [Guided local coding assistants](../local-coding-assistants/README.md)
- [Shared surface kernel](../shared-surface-kernel/README.md)
- [Tax privacy and filing boundaries](../tax/privacy-and-filing-boundaries.md)
- [Tax data import and export](../tax/data-import-export.md)
