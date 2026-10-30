import { describe, expect, it } from "vitest";
import {
  contextFor,
  demoResponse,
  parseModelResult,
  planForTurn,
} from "../worker/model";
import type { SessionData } from "../src/types";
const empty: SessionData = { messages: [], memories: [], plan: null };
describe("plan replacement boundary", () => {
  const generated = {
    title: "New plan",
    steps: Array.from({ length: 3 }, (_, i) => ({
      title: `Step ${i}`,
      description: "Practice this concept.",
    })),
  };
  const current = {
    title: "Current plan",
    steps: [
      {
        id: "completed-step",
        title: "Keep my work",
        description: "Already done",
        done: true,
      },
    ],
  };
  it("creates an initial plan with fresh incomplete steps", () => {
    const plan = planForTurn(null, generated, false)!;
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps.every((step) => !step.done && !!step.id)).toBe(true);
  });
  it("preserves existing progress even if a follow-up model returns a new plan", () => {
    expect(planForTurn(current, generated, false)).toBe(current);
    expect(current.steps[0].done).toBe(true);
  });
  it("replaces a plan only with explicit permission", () => {
    const next = planForTurn(current, generated, true)!;
    expect(next.title).toBe("New plan");
    expect(next.steps[0].id).not.toBe("completed-step");
    expect(next.steps[0].done).toBe(false);
  });
});
describe("model trust boundary", () => {
  it("accepts structured and JSON-string model replies", () => {
    const value = { reply: "Let’s learn.", plan: null, suggestedMemory: null };
    expect(parseModelResult(value)).toEqual(value);
    expect(parseModelResult(JSON.stringify(value))).toEqual(value);
  });
  it.each([
    {},
    { reply: "", plan: null, suggestedMemory: null },
    { reply: "x", plan: null, suggestedMemory: 42 },
    { reply: "x", plan: { title: "x", steps: [] }, suggestedMemory: null },
    {
      reply: "x",
      plan: {
        title: "x",
        steps: Array(3).fill({ title: "x", description: 42 }),
      },
      suggestedMemory: null,
    },
    { reply: "x".repeat(12001), plan: null, suggestedMemory: null },
  ])(
    "rejects invalid output before it can change persistent state: %j",
    (value) => {
      expect(() => parseModelResult(value)).toThrow();
    },
  );
  it("rejects invalid JSON", () =>
    expect(() => parseModelResult("not json")).toThrow());
  it("includes only approved memories and current plan in context", () => {
    const data: SessionData = {
      ...empty,
      memories: [{ id: "m", text: "Use examples", createdAt: "" }],
      messages: [
        {
          id: "a",
          role: "assistant",
          content: "secret",
          createdAt: "",
          suggestedMemory: "unapproved",
        },
      ],
    };
    expect(contextFor(data)).toBe(
      JSON.stringify({ savedPreferences: ["Use examples"], activePlan: null }),
    );
  });
  it("keeps preview output labeled and valid", () => {
    for (const text of [
      "Make me a learning plan",
      "Quiz me",
      "Explain Durable Objects",
      "Hello",
    ]) {
      const response = demoResponse(text, empty);
      expect(parseModelResult(response)).toEqual(response);
      expect(response.reply.toLowerCase()).toContain("preview");
    }
  });
});
