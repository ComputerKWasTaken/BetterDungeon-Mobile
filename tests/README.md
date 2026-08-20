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
- **`navigator-context-allocator.test.js`** - Navigator snapshot budgeting, proportional allocation, section ceilings, truncation and degradation metadata, floor budgets, and hostile-budget behavior.
- **`navigator-contract.test.js`** - Mobile asset injection order, GraphQL readers and fallbacks, context and read-tool behavior, streaming persistence and abort handling, tool guidance, proposal floors, and request inspection.
- **`navigator-mobile-contract.test.js`** - Mobile Navigator sheet styling and tokens, compass and drawer runtime behavior, IME-safe positioning, Android Back handling, settings synchronization, and mobile activity labels.
- **`navigator-mutation-contract.test.js`** - GraphQL writers, authoritative Story Card safety gates, mutation boundaries, approval flow, and static feature integration.
- **`navigator-options-contract.test.js`** - Effective Navigator settings, read-only and context-section behavior, provider input limits, section omission and degradation, tool activity labels, drawer integration, and request inspection.
- **`navigator-proposal-lifecycle-contract.test.js`** - Proposal persistence and restoration, applied hydration diagnostics, conflict and timestamp-drift handling, and proposal creation and mutation lifecycle behavior.
- **`navigator-retrieval-contract.test.js`** - Bounded Story Card, Memory Bank, and story-history retrieval, ranking and truncation, per-turn deduplication, and retrieval proposal behavior.
