import assert from "node:assert/strict";
import { chromium, request } from "@playwright/test";

const target = process.argv[2];
if (!target || new URL(target).protocol !== "https:") {
  console.error(
    "Usage: npm run verify:deployed -- https://your-worker.workers.dev",
  );
  process.exit(1);
}
const origin = new URL(target).origin;
const proxyAddress = process.env.https_proxy || process.env.HTTPS_PROXY;
const proxyUrl = proxyAddress ? new URL(proxyAddress) : undefined;
const proxy = proxyUrl
  ? {
      server: proxyUrl.origin,
      ...(proxyUrl.username
        ? {
            username: decodeURIComponent(proxyUrl.username),
            password: decodeURIComponent(proxyUrl.password),
          }
        : {}),
    }
  : undefined;
const client = await request.newContext({
  baseURL: origin,
  proxy,
  extraHTTPHeaders: { origin },
  timeout: 65000,
});
const isolated = await request.newContext({ baseURL: origin, proxy });
let browser;
async function call(path, method = "GET", data) {
  const response = await client.fetch(`/api/${path}`, { method, data });
  const result = await response.json();
  assert.equal(
    response.status(),
    200,
    `${method} ${path}: ${result.error ?? response.status()}`,
  );
  return result;
}
try {
  assert.equal(
    (await client.get("/")).status(),
    200,
    "Hosted frontend must respond",
  );
  assert.equal(
    (await call("session")).mode,
    "live",
    "Hosted app must use live inference",
  );
  await call("memories", "POST", { text: "I prefer TypeScript examples." });
  const turn = {
    id: crypto.randomUUID(),
    message:
      "Make me a three-step learning plan to build a simple Cloudflare Workers app. Keep your reply short.",
  };
  const result = await call("chat", "POST", turn);
  assert.equal(result.messages.length, 2);
  assert.ok(
    result.messages[1].content.length > 10,
    "Real model reply must be present",
  );
  assert.ok(
    result.plan?.steps.length >= 3 && result.plan.steps.length <= 6,
    "Model must generate a valid plan",
  );
  assert.equal(
    (await call("chat", "POST", turn)).messages.length,
    2,
    "Retry must not duplicate a turn",
  );
  const step = result.plan.steps[0];
  await call("plan", "PATCH", { id: step.id, done: true });
  const recalled = await call("chat", "POST", {
    id: crypto.randomUUID(),
    message:
      "Which programming language should your code examples use for me? Reply in one sentence, using my saved preferences.",
  });
  assert.match(
    recalled.messages.at(-1).content,
    /TypeScript/i,
    "Live model must recall the approved preference",
  );
  assert.equal(
    recalled.plan.steps[0].done,
    true,
    "Follow-up must preserve completed progress",
  );
  const other = await (await isolated.get("/api/session")).json();
  assert.equal(
    other.memories.length,
    0,
    "Anonymous sessions must remain isolated",
  );
  browser = await chromium.launch({ channel: "chrome", headless: true, proxy });
  const context = await browser.newContext({
    storageState: await client.storageState(),
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await page
    .getByRole("button", { name: "Workers AI connected", exact: true })
    .waitFor();
  await page.getByRole("log").waitFor();
  await page
    .getByRole("button", { name: "Learning plan", exact: true })
    .click();
  assert.equal(
    await page.locator("main").getByRole("checkbox").first().isChecked(),
    true,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Workers AI connected", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Memory", exact: true }).click();
  assert.match(
    await page.locator("main .memory-list").innerText(),
    /TypeScript/,
  );
  assert.deepEqual(errors, [], "Browser must have no page errors");
  console.log(
    JSON.stringify(
      {
        url: origin,
        transport: new URL(origin).protocol,
        liveModel: "Llama 3.3 / Workers AI",
        planSteps: result.plan.steps.length,
        checks: [
          "hosted frontend",
          "live inference",
          "plan generation",
          "retry deduplication",
          "saved progress",
          "memory recall",
          "session isolation",
          "browser reload",
          "no page errors",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  // Only this verification run's fresh session is erased; existing users are untouched.
  try {
    await call("session", "DELETE");
  } catch {
    /* Preserve the original verification error. */
  }
  await browser?.close();
  await client.dispose();
  await isolated.dispose();
}
