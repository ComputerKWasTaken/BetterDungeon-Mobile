# BetterDungeon Mobile Tests

Test artifacts for BetterDungeon Mobile. These dependency-free Node suites
exercise the shared JavaScript assets under
`app/src/main/assets/betterdungeon` and the mobile-specific bridge and UI
contracts without requiring an Android runtime.

## Node contract suites

These dependency-free Node suites can be run individually with:

`node tests/<name>.test.js`

- **`adventure-read-contract.test.js`** - Apollo-first adventure reads, GraphQL and WebSocket fallback merging, provenance and coverage diagnostics, post-write memory bypasses, action refresh coordination, and Desktop/Mobile reader wiring.
- **`adventure-write-hydration-contract.test.js`** - Verified Plot, Story Card, and Memory Bank hydration, refetch diagnostics, unsupported routing, and guarded Plot editor hydration with mounted-sibling checks and the outstanding-field ledger.
- **`ai-compatible-contract.test.js`** - Compatible AI profile and capability behavior, text and JSON requests, Gemini reasoning and rate-limit handling, streaming, cancellation, timeouts, errors, and opaque thought-signature replay across tool rounds.
- **`ai-popup-bridge-contract.test.js`** - Popup startup synchronization with the native bridge, including delayed readiness and already-ready bridge paths.
- **`ai-transport-contract.test.js`** - Mobile popup runtime routing plus native-compatible streaming, query, Gemini streaming, and cancellation behavior.
- **`apollo-cache-contract.test.js`** - Apollo bridge wiring, operation allowlisting, unavailable and direct-error handling, Adventure denormalization, memo invalidation, relay pairing, and timeout recovery.
- **`apollo-consumer-contract.test.js`** - Apollo-first Story Card scanning with fallback behavior, Ultrascripts history compatibility, and Auto See warm-tail refresh coordination.
- **`branch-persistence-contract.test.js`** - Supported AI Dungeon branch allowlisting, remembered-branch restoration, and in-app navigation persistence.
- **`navigator-assets-contract.test.js`** - Navigator v2.1 injection order and current context, retrieval, mutation, inspection, and UI asset contracts.
- **`navigator-change-mode-contract.test.js`** - Canonical Automatic, Proposed changes, and No changes enforcement, legacy fallbacks, and fail-closed storage behavior.
- **`navigator-chat-qol.test.js`** - Automatic defaults, sanitized tool activity, change-mode behavior, deletion approval, inspection capture, and legacy mode migration.
- **`navigator-context-contract.test.js`** - Always-attempted bounded context, coverage metadata, and exact Inspector-section parity with the final system instruction.
- **`navigator-mobile-contract.test.js`** - Mobile Gameplay-subtab integration, three-way Changes UI, dedicated Inspector, IME-safe sizing, touch targets, and Inspector-first Android Back handling.
- **`navigator-proposal-lifecycle-contract.test.js`** - Proposal persistence and restoration, applied hydration diagnostics, conflict and timestamp-drift handling, and proposal creation and mutation lifecycle behavior.
- **`navigator-settings-contract.test.js`** - Gameplay-subtab styling, native swipe navigation without custom tab arrows, the compact Changes toggle, removed context/message actions, dedicated Inspector, and reduced-motion behavior.
- **`navigator-tools-contract.test.js`** - Current primer contract, bounded retrieval payloads, explicit field truncation, and removal of Read Plot Components.
