import { expect, test } from "@playwright/test";
const origin = "http://127.0.0.1:8787";

test("learning journey: chat, plan, progress, approved memory, reload, export and erase", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Local preview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /A little curiosity/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Find my starting point/ }).click();
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("log")).toContainText("fixed preview response");
  await page
    .getByRole("button", { name: "Learning plan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your learning plan." }),
  ).toBeVisible();
  await page.locator("main").getByRole("checkbox").first().check();
  await expect(page.locator("main")).toContainText("1 of 4 steps complete");
  await page.getByRole("button", { name: "Memory", exact: true }).click();
  await page
    .getByLabel("Add a goal or preference")
    .fill("I learn best through practical examples.");
  await page.getByRole("button", { name: "Save memory", exact: true }).click();
  await expect(page.locator("main .memory-list")).toContainText(
    "I learn best through practical examples.",
  );
  await page.reload();
  await expect(page.getByRole("log")).toContainText("fixed preview response");
  await page
    .getByRole("button", { name: "Learning plan", exact: true })
    .click();
  await expect(
    page.locator("main").getByRole("checkbox").first(),
  ).toBeChecked();
  await page.getByRole("button", { name: "Memory", exact: true }).click();
  await expect(page.locator("main .memory-list")).toContainText(
    "I learn best through practical examples.",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export workspace" }).click();
  expect((await download).suggestedFilename()).toBe("waypoint-workspace.json");
  await page.getByRole("button", { name: "New conversation" }).click();
  await expect(
    page.getByRole("heading", { name: /A little curiosity/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Memory", exact: true }).click();
  await expect(page.locator("main .memory-list")).toContainText(
    "I learn best through practical examples.",
  );
  await page
    .getByRole("button", { name: "Erase workspace", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Erase workspace", exact: true })
    .click();
  await expect(page.locator("main .memory-list")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Learning plan", exact: true })
    .click();
  await expect(page.locator("main")).toContainText("Big goals. Small steps.");
});

test("API validates input, isolates sessions, and deduplicates retries", async ({
  playwright,
}) => {
  const a = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { origin },
  });
  const b = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { origin },
  });
  await a.get("/api/session");
  await b.get("/api/session");
  const added = await a.post("/api/memories", {
    data: { text: "I prefer short examples." },
  });
  expect(added.ok()).toBeTruthy();
  expect((await (await b.get("/api/session")).json()).memories).toHaveLength(0);
  expect(
    (
      await a.post("/api/chat", { data: { id: "invalid-empty", message: " " } })
    ).status(),
  ).toBe(400);
  expect(
    (
      await a.post("/api/chat", {
        data: { id: "invalid-long", message: "x".repeat(4001) },
      })
    ).status(),
  ).toBe(400);
  const turn = {
    id: "retry-safe-message-123",
    message: "Explain Durable Objects",
  };
  expect((await a.post("/api/chat", { data: turn })).ok()).toBeTruthy();
  const retried = await (await a.post("/api/chat", { data: turn })).json();
  expect(retried.messages).toHaveLength(2);
  expect(retried.memories).toHaveLength(1);
  expect(
    (
      await a.post("/api/memories", {
        data: { text: "x" },
        headers: { origin: "https://other.example" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await a.post("/api/memories", {
        data: "{no",
        headers: { "content-type": "application/json" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await a.post("/api/memories", {
        data: { text: "I prefer short examples." },
      })
    ).ok(),
  ).toBeTruthy();
  expect((await (await a.get("/api/session")).json()).memories).toHaveLength(1);
  const planned = await (
    await a.post("/api/chat", {
      data: {
        id: "initial-plan-regression",
        message: "Create a learning plan",
      },
    })
  ).json();
  const stepId = planned.plan.steps[0].id;
  await a.patch("/api/plan", { data: { id: stepId, done: true } });
  const followup = await (
    await a.post("/api/chat", {
      data: {
        id: "followup-plan-regression",
        message: "Make me another learning plan",
      },
    })
  ).json();
  expect(followup.plan.steps[0].id).toBe(stepId);
  expect(followup.plan.steps[0].done).toBe(true);
  const replaced = await (
    await a.post("/api/chat", {
      data: {
        id: "explicit-plan-replacement",
        message: "Make me another learning plan",
        replacePlan: true,
      },
    })
  ).json();
  expect(replaced.plan.steps[0].id).not.toBe(stepId);
  expect(replaced.plan.steps[0].done).toBe(false);
  await a.dispose();
  await b.dispose();
});

test("mobile navigation and composer fit a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Local preview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Message Waypoint" }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Memory", exact: true }).click();
  await expect(page.getByLabel("Add a goal or preference")).toBeVisible();
  await page.getByRole("button", { name: "Conversation", exact: true }).click();
  await page.getByRole("button", { name: /Make it click/ }).click();
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("log")).toContainText("tiny coordinator");
});
