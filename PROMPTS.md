# Waypoint — AI-assisted development record

Prepared for manager verification · October 31, 2026 (Asia/Kolkata)

**Live application:** [Waypoint](https://cf-ai-waypoint.cf-ai-waypoint.workers.dev)

**Record scope:** The 15 first-person prompts below are a retrospective reconstruction of instructions corresponding to the completed work, written after implementation. Appendix A preserves the actual user messages; the reconstructed sequence is a development walkthrough, not a verbatim conversation transcript.

## Requirement and evidence map

| Assignment component         | Implemented behavior                                                | Evidence                                                                        |
| ---------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| LLM                          | Llama 3.3 through the Workers AI binding                            | `worker/model.ts`, `worker/index.ts`, hosted verification                       |
| Workflow / coordination      | Worker routing and per-session Durable Object coordination          | `worker/index.ts`, `wrangler.jsonc`                                             |
| User input via chat or voice | Responsive text chat with real model responses                      | `src/main.tsx`, browser tests, hosted verification                              |
| Memory or state              | Persistent chat, approved notes, learning plan, and completed steps | Durable Object storage, model context construction, reload and isolation checks |
| Prompt-history documentation | Actual messages plus this identified reconstructed sequence         | Appendix A and the prompt walkthrough below                                     |

The application passed 13 unit tests, three local browser/API tests, and the hosted HTTPS verification of inference, plan generation, memory recall, retained progress, retries, session isolation, and reload behavior. See [VALIDATION.md](VALIDATION.md) for the observed results and [README.md](README.md) for setup and architecture.

## Detailed prompt walkthrough — reconstructed

Each prompt specifies an objective, implementation constraints, and review criteria. The wording is presented in the first person so the sequence is also useful as a practical guide for directing a similar build.

### Prompt 1 — Understand the assignment

> I want to build a strong submission for this Cloudflare assignment. Read the assignment and the linked official documentation, then map every requirement to a concrete feature we can demonstrate. Separate required capabilities from recommended products. Explain whether a text-chat interface is sufficient and what would count as meaningful memory. Don't start coding until you have identified a manageable scope.
>
> For each requirement, tell me which user interaction demonstrates it, which Cloudflare service provides it, and how we will verify it. Treat Pages and Realtime as recommendations rather than assuming both are mandatory. Keep the scope achievable for an assignment: one coherent application with working inference, coordination, chat input, and persistent state. Flag any interpretation that cannot be established from the assignment text.

Review focus: it establishes acceptance criteria before choosing technologies or adding features.

### Prompt 2 — Choose a focused application

> Let's build Waypoint, an AI learning companion. I want a user to describe a learning goal, receive a practical learning plan, ask follow-up questions, and track completed steps. The assistant should also remember learning preferences the user chooses to save. Keep the first version focused on this journey. Describe a short demo that would show all four assignment requirements working together.
>
> The main journey should start with a learner saying what they want to learn and how much time they have. The app should produce a small plan, support explanations and practice questions, and remember preferences only when the learner approves them. Make the value of memory visible in a later response. Keep the demo understandable without requiring me to explain the backend first.

Review focus: a concrete user journey makes the requirements easier to implement and evaluate.

### Prompt 3 — Inspect the workspace and propose the architecture

> Inspect the existing workspace and any project instructions before making changes. Create the application in its own `cf-ai-waypoint` directory and preserve unrelated files. Propose an architecture using React and TypeScript for the UI, Cloudflare Workers for requests, Llama 3.3 on Workers AI, and a SQLite-backed Durable Object for each browser session. Explain how requests reach the right session and how state survives a reload. If Workers Static Assets can host the UI, explain that choice relative to the assignment's Pages recommendation.
>
> Keep the responsibilities explicit: the React client collects input and displays results; the Worker validates and routes requests; the Durable Object coordinates each session and stores its data; Workers AI provides inference. Use a random session identity with an HttpOnly cookie and explain the browser-specific limitations. Show the request and persistence flow in a simple architecture diagram before we rely on it in the README.

Review focus: it gives the assistant enough context to work safely and makes architectural assumptions visible.

### Prompt 4 — Scaffold a runnable project

> Create the project structure, npm scripts, TypeScript configuration, and Wrangler configuration. Bind Workers AI and the learning-session Durable Object, including its SQLite migration. Keep the frontend and API on the same origin. Check the current Cloudflare documentation for the model identifier and binding syntax, and install compatible dependencies. I should be able to build the frontend and run a Cloudflare packaging dry run using documented commands.
>
> Include separate commands for building, typechecking, unit tests, browser tests, local preview, live development, deployment, and deployment verification. Make sure the Wrangler migration declares the Durable Object as SQLite-backed and that static assets are built before deployment. Check package compatibility instead of bypassing dependency conflicts. Commit a reproducible lockfile using public package URLs, and keep credentials and generated local state out of the source package.

Review focus: it asks for a working foundation with concrete commands, rather than a collection of disconnected files.

### Prompt 5 — Build the chat experience

> Implement a responsive chat interface for Waypoint with a welcoming empty state and three starter prompts: make a learning plan, explain a concept, and quiz me. Support typing a message, Enter to send, and Shift+Enter for a new line. Show a pending response state and useful errors with a retry action. Render assistant Markdown safely. Include navigation to a learning plan and memory view, and make sure the composer and navigation fit on a phone screen.
>
> Keep the interaction states clear: first visit, message being edited, request pending, successful response, and failed response. Disable conflicting submissions during a request, preserve enough information to retry a failed message, and give every interactive control an accessible name. Use a calm visual style with a clear distinction between the conversation, the active plan, and saved preferences. Check keyboard input and a 390-pixel-wide mobile layout.

Review focus: interaction details and small-screen behavior are part of the requested result, not left for the assistant to guess.

### Prompt 6 — Connect real Llama 3.3 inference

> Connect the chat API to Llama 3.3 through the Workers AI binding. Write a system prompt for a concise, practical learning companion. Request a structured response with a Markdown reply, an optional learning plan, and an optional memory suggestion. Validate the returned structure and field lengths before using it. Handle provider failures and malformed output without saving a partial turn. Live mode must not silently fall back to a fixed example response.
>
> Use the Workers AI binding from server-side code so the browser never needs an LLM credential. Keep the system instructions, output schema, and response validation easy to inspect. Plans should contain a bounded number of actionable steps, and suggested memory must remain separate from approved memory. Return a useful error for malformed output, a missing binding, provider failure, or timeout. Do not persist an unvalidated plan or advertise tools the assistant does not have.

Review focus: it specifies both the successful path and the boundary between unpredictable model output and application state.

### Prompt 7 — Add persistent, user-controlled memory

> Implement actual persistent memory using Durable Object storage. Save the conversation, active learning plan, completed steps, and approved learning preferences. Use a private random browser-session cookie rather than putting session identifiers in URLs. Let me add and remove memory notes in the UI. The model can suggest a note, but it must not become saved memory until I accept it. Include approved notes, the current plan, and recent messages in later model calls. Document the retention limits and what happens if the browser cookie is cleared.
>
> Store the latest 100 chat messages and use the latest 12 messages, the active plan, and approved notes as model context. Allow up to 20 memory notes with bounded lengths. State clearly that this is structured session memory rather than vector search or cross-device account synchronization. Verify that starting a new conversation keeps approved preferences, while erasing the workspace removes chat, plan, and memories. A separate anonymous session must start empty.

Review focus: it defines what is remembered, who controls it, and how that memory affects later responses.

### Prompt 8 — Make learning plans useful

> Turn a model-generated plan into a visible checklist with concrete steps and a progress indicator. Save checkbox changes to the server and show the same progress after a reload. Update checkboxes immediately, but restore the previous value and show an error if saving fails. Starting a new conversation should clear chat while retaining the learning plan and saved preferences. Provide a separate action to erase the whole workspace and an option to export its contents.
>
> Give each plan step a stable identifier and a saved completion value. Both the main plan view and the context panel should show the same progress after a successful update. Keep the optimistic checkbox update reversible when the server rejects a change. Export should produce a usable JSON snapshot, and erasure should explain which data will be deleted. Describe the difference between forgetting a note and deleting previous chat messages that mention it.

Review focus: it translates a broad feature like "state" into observable behavior and explicit controls.

### Prompt 9 — Protect state during retries and overlapping requests

> Review the request lifecycle for race conditions and failures. Allow only one mutation at a time in a learning session so simultaneous requests cannot overwrite each other. Save a successful chat turn and its plan in one atomic storage operation. Use client message IDs to avoid duplicating a committed turn when the user retries. Add bounded request bodies, message lengths, per-session inference limits, and a model timeout. Explain the limits of these protections, especially if a process fails during inference.
>
> Enforce the limits on the server rather than relying only on the UI. Bound incoming JSON to 20 KB, chat input to 4,000 characters, and memory notes to 240 characters. Use a per-session allowance of 30 inference attempts per hour and a 45-second inference timeout. Reject cross-origin mutations and overlapping writes. Document that a per-session limit is not global abuse prevention and that retry deduplication applies while the original message is retained.

Review focus: it names realistic failure cases and asks the assistant to describe the guarantees accurately.

### Prompt 10 — Add a clearly labeled offline preview

> Add a local preview configuration so I can review the UI and persistence without signing in to Cloudflare. Use fixed example responses only in that explicit mode, and show a visible Local preview badge with an explanation. Keep the real Worker, Durable Object storage, and API controls in use locally. The default deployment configuration must use real Workers AI with demo mode disabled. Document how to run both modes.
>
> Use separate Wrangler configurations so preview mode is an intentional choice. Preview replies should identify themselves as fixed examples, while plan checkboxes, memory controls, reload persistence, and the API still operate against the local runtime. The production configuration should bind Workers AI and set demo mode to false. Explain that preview success verifies the local journey but does not prove model quality or hosted deployment success.

Review focus: it separates a convenient development experience from evidence that real AI inference works.

### Prompt 11 — Test complete user journeys

> Verify the application with tests that would catch meaningful failures. Add unit tests for invalid model output and for excluding unapproved memory from context. Run browser and API tests against the real local Worker and Durable Object. Cover creating a plan, completing a step, saving a preference, reloading, exporting, starting a new conversation, and erasing the workspace. Check session isolation, invalid requests, duplicate retries, and a narrow mobile viewport. Capture desktop and mobile screenshots and inspect them for clipping or overflow. Fix failures before reporting success.
>
> For each test, identify the behavior it protects. Reject invalid model replies and plans before storage; ensure unapproved suggestions do not enter memory context; verify duplicate messages and notes are handled correctly. Exercise the full browser journey against the local Cloudflare runtime rather than mocking every layer. Inspect screenshots, capture browser errors, and fix layout problems that prevent typing or navigation. Report failed checks as failures until the fix has been tested.

Review focus: it asks for evidence across the actual application boundaries instead of treating a successful build as sufficient verification.

### Prompt 12 — Deploy instead of stopping at a dry run

> Run the documented deployment process for this project. Check whether Wrangler is authenticated first. If a browser login is needed, start the official login flow and let me complete it. Use the normal corporate proxy and trusted certificate settings if needed; preserve TLS verification. After the checks pass, publish the live configuration to my Cloudflare account and return the hosted URL and deployed version. A dry run alone should not be reported as a completed deployment.
>
> Check the authenticated account before publishing so deployment goes to the intended destination. Do not paste credentials into source files or the submission record. If the OAuth token exchange fails, distinguish a proxy or certificate problem from an application problem and use the configured trusted network settings. After publishing, capture the active version and the workers.dev URL. Check HTTPS reachability separately from the deployment command reporting success.

Review focus: it distinguishes preparation from the requested external result and identifies the point that needs user participation.

### Prompt 13 — Verify the hosted application with real AI

> Test the deployed HTTPS URL using a fresh anonymous session. Save the preference "I prefer TypeScript examples," ask the real model for a three-step Cloudflare Workers learning plan, and complete its first step. Ask a follow-up that requires recalling the saved language preference. Verify that the completed step remains complete, that a duplicate request does not create another turn, and that a second session cannot see the first session's data. Open the hosted UI in Chrome and confirm the saved state survives a reload. Clean up only the test session and record what passed or failed.
>
> Use only synthetic test data and a fresh test session. Verify the frontend and API on the actual hosted origin, not just localhost. Confirm that the response comes from live mode, the model creates a valid plan, and a preference influences a subsequent answer. Inspect the plan again after the follow-up and after a browser reload. Check for page errors and erase the verification session afterward without touching another user's workspace. Save the observed results in the verification record.

Review focus: specific inputs and expected observations make "verified deployment" a reproducible claim.

### Prompt 14 — Fix the plan-reset bug found in verification

> The hosted test found a bug: a follow-up response can contain a new plan, and saving it resets the user's completed steps. Fix the application so preserving progress does not depend on the model obeying a prompt. Require an explicit user action to replace an existing plan, and enforce that permission on the server. Add regression tests where the model supplies an unwanted replacement plan and confirm the existing step IDs and completion values remain unchanged. Also test that an intentional replacement works. Redeploy and rerun the hosted checks.
>
> Treat the model output as a proposal, not permission to overwrite an existing plan. Add an explicit replacement control to the composer and pass that decision to the server as a boolean. The server must preserve the existing plan and its completed steps whenever permission is absent, regardless of what the model returns. With permission present, create fresh step identifiers and reset completion for the new plan. Cover both branches with regression tests and rerun the hosted HTTPS journey.

Review focus: it reports a concrete symptom, identifies the state that must be protected, and defines a regression check for the fix.

### Prompt 15 — Prepare the submission and explain the design

> Review the final application against the assignment one more time. Update the README with the live URL, architecture, setup commands, deployment steps, and a short walkthrough that demonstrates chat and persistent memory. Record the actual tests and hosted verification results in VALIDATION.md, including material limits. Update PROMPTS.md with the real prompts used and clearly label any retrospective teaching examples. Package the source without dependencies, credentials, local state, or build artifacts. Explain the request flow and storage model so I can discuss the implementation myself.
>
> Make the handoff easy for my manager to inspect: link the live application, show where each requirement is implemented, document how to run it, and separate local test results from hosted verification. Keep the actual user messages and the reconstructed prompt walkthrough distinguishable. Include the discovered plan-reset bug and the verified fix so the record explains the engineering decisions. Package only the source and documentation, and give me a short walkthrough I can reproduce during review.

Review focus: it combines a reviewable handoff with the understanding needed to explain the project beyond the demo.

## Appendix A — Actual user-message history

### A.1. Original user task (verbatim text, with links preserved)

> We plan to fast track candidates who complete an assignment to build a type of [AI-powered application](https://agents.cloudflare.com/) on Cloudflare. An AI-powered application should include the following components:
>
> - LLM (recommend using Llama 3.3 on Workers AI), or an external LLM of your choice
> - Workflow / coordination (recommend using Workflows, Workers or Durable Objects)
> - User input via chat or voice (recommend using Pages or Realtime)
> - Memory or state
>
> Find additional documentation [here](https://developers.cloudflare.com/agents/).
>
> _Note: AI-assisted coding is encouraged, but you have to submit prompt history._

The assistant stated that it would inspect the workspace and documentation and build an assignment-ready application. That turn was interrupted before any tool calls ran.

### A.2. User continuation (verbatim)

> contiune

The assistant resumed implementation in a new `cf-ai-waypoint` directory, preserving unrelated workspace folders.

### A.3. Deployment follow-up (verbatim)

> why can't u verify deployment?? there are deplyment steps in documentation right?

The assistant checked Cloudflare authentication, found Wrangler was not signed in, and started OAuth login. An OAuth token-exchange timeout required enabling the corporate proxy and system CA settings for Node. The Cloudflare token endpoint was confirmed reachable with those settings.

### A.4. Login retry (verbatim)

> let's try again

The assistant restarted the OAuth flow with the corrected network settings and added `scripts/verify-deployment.mjs` to verify real Workers AI inference, generated plans, memory recall, persistence, and session isolation on a hosted URL. Actual deployment results belong in `VALIDATION.md`; the existence of this script does not imply it has passed.

Cloudflare login subsequently succeeded. The assistant deployed the live Worker and encountered a temporary TLS handshake failure on the newly registered `workers.dev` hostname. HTTPS then became available. A diagnostic hosted run using real Llama 3.3 responses found that a follow-up could reset plan progress when the model returned an unexpected replacement plan. The assistant added a server-enforced replacement guard, a composer control for explicit replacement, and regression tests, then redeployed the fix. Final verification results are recorded in `VALIDATION.md`.

### A.5. Requirements and prompt-history review (actual user message)

> are u sure all requirements full filled, specially
>
> 1. User input via chat or voice (recommend using Pages or Realtime)
> 2. Memory or state
>
> Note: AI-assisted coding is encouraged, but you have to submit prompt history.
>
> what have u included in prompt history

The assistant inspected the implementation and this file, explained how chat and persistent memory meet the assignment, and distinguished this curated log from a complete raw chat transcript.

### A.6. Educational prompt sequence request (actual user message)

> ok so in the prompts.md ... u should include prompts .... by considering that i was the one u was constantly giving u prompts on what to do... even though u did urself ... can u do it...
> it will help me learn how to give prompt'

The assistant added the reconstructed sequence in this document in response, while retaining the actual messages separately.

## Appendix B — Autonomous implementation work

These are summaries of the implementation work, not additional user prompts:

1. Chose **Waypoint**, a learning companion, to make stateful AI behavior demonstrable: learning goals, a plan with progress, follow-up teaching, and explicit memory preferences.
2. Consulted official Cloudflare documentation for the Llama 3.3 binding, structured JSON output, Durable Objects, and static asset hosting.
3. Chose React/TypeScript for the chat UI and a Worker plus SQLite-backed Durable Object for routing, coordination, and storage.
4. Added a live Workers AI path and a separate, labeled deterministic local preview path, so reviewers can inspect the app without credentials without mistaking examples for real inference.
5. Added request and model-output validation, atomic turn persistence, per-session inference limits, same-origin mutation checks, anonymous HttpOnly session cookies, and retry deduplication.
6. Designed an interface for conversation, plan completion, approved memories, export, and erasure, including mobile layouts.
7. Added unit tests around the model boundary and browser/API tests against the local Worker. Added run and deployment instructions and recorded actual verification results in `VALIDATION.md`.

## Appendix C — Application runtime prompts

The checked-in, current source is the authoritative prompt history for runtime inference:

- [`SYSTEM_PROMPT` in `worker/model.ts`](worker/model.ts): teaching behavior, context handling, plan-generation rules, and opt-in memory rules.
- [`RESPONSE_SCHEMA` in `worker/model.ts`](worker/model.ts): required JSON reply, optional plan, and optional suggested memory.
- [`worker/index.ts`](worker/index.ts): the exact message construction, including serialized approved preferences/current plan, the last 12 chat messages, and the user's new message.
- [`STARTERS` in `src/main.tsx`](src/main.tsx): the exact three starter prompts displayed in the UI.

Local preview does not send prompts to an LLM. The demo responder is explicit in `worker/model.ts`. This file is the implementation prompt record; the separate `VALIDATION.md` records actual live and local verification.

## Appendix D — Prompt-writing pattern

A useful structure for a new request is:

> I want **[an observable result]**. The relevant context is **[current project and behavior]**. Keep these constraints: **[technology, scope, or data rules]**. Check completion by **[specific evidence or test]**. Tell me **[an important uncertainty or tradeoff]**.

For a follow-up, describe the actual observation: “The checkbox changes, but reload loses the change” is more actionable than “memory is broken.” Use each result to decide the next request instead of trying to predict every implementation detail at the beginning.

If a complete raw conversation is requested for review, include the original chat export alongside this record.
