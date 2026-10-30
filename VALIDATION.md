# Verification record

Verified October 31, 2026 (Asia/Kolkata), both locally and on the deployed Cloudflare Worker.

**Live app:** https://cf-ai-waypoint.cf-ai-waypoint.workers.dev

**Verified deployment version:** `11d3e454-9237-43f1-aff5-73492124500d`.

| Check                                                                                                      | Result                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript (`npm run typecheck`)                                                                           | Passed. Client and Worker typechecked.                                                                                                                                                                                                                           |
| Model boundary (`npm test`)                                                                                | 13 tests passed, including malformed responses, invalid plans, unapproved memory exclusion, explicit demo labeling, and server-enforced plan replacement.                                                                                                        |
| Production client (`npm run build`)                                                                        | Passed. React client bundled by Vite.                                                                                                                                                                                                                            |
| Browser/API (`npm run test:e2e`)                                                                           | 3 tests passed against a real Wrangler/miniflare Worker and SQLite-backed Durable Objects using Google Chrome.                                                                                                                                                   |
| Cloudflare bundle (`npm run deploy:dry`)                                                                   | Passed with live `AI`, `ASSETS`, and `LEARNING_SESSIONS` bindings and `DEMO_MODE=false`. No deployment performed.                                                                                                                                                |
| Cloudflare deployment                                                                                      | Published successfully to the user's authenticated account with Workers AI, Static Assets, and a SQLite-backed Durable Object.                                                                                                                                   |
| Hosted HTTPS verification (`npm run verify:deployed -- https://cf-ai-waypoint.cf-ai-waypoint.workers.dev`) | Passed: hosted frontend, two real Llama 3.3 calls, a generated three-step plan, retry deduplication, completed progress, TypeScript preference recall, isolated sessions, browser reload, and no page errors. The synthetic test workspace was erased afterward. |
| Dependency audit                                                                                           | 0 known vulnerabilities after updating Vitest to 5.0.5. This is the registry advisory result at verification time, not a general security guarantee.                                                                                                             |
| Visual review                                                                                              | Captured and inspected a 1440 × 900 desktop layout and a 390 × 844 mobile layout. No horizontal overflow; composer and mobile navigation fit. No browser page errors captured.                                                                                   |

The browser journey creates a plan, completes a step, saves a preference, reloads to verify persistence, exports the workspace, starts a new conversation while retaining context, and erases the workspace. API checks cover isolated sessions, empty and oversized messages, malformed JSON, same-origin enforcement, duplicate memory prevention, and duplicate request IDs.

Issues found and fixed during verification:

- Plan checkboxes now update immediately and restore their previous value if saving fails, instead of briefly reverting during the request.
- A real model follow-up returned a replacement plan and reset progress in the first hosted diagnostic run. The server now preserves the active plan unless replacement is explicitly enabled for the message. Regression tests verify both preserved progress and intentional replacement. The full hosted HTTPS run passed after redeployment.
- OAuth initially timed out at the token endpoint. Enabling Node's corporate proxy and system CA support resolved the connection without disabling TLS validation.
- The newly registered `workers.dev` hostname initially rejected TLS handshakes. HTTPS became available afterward, and the final verification used HTTPS throughout.

Account billing configuration and behavior under production load were not verified. These targeted checks establish the observed workflows, not general model quality or universal model obedience. The production app uses Llama 3.3 on Workers AI; local preview remains an explicitly labeled deterministic mode.
