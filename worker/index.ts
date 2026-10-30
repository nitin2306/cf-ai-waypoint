import { DurableObject } from "cloudflare:workers";
import type { Message, SessionData, Snapshot } from "../src/types";
import {
  contextFor,
  demoResponse,
  MODEL,
  parseModelResult,
  planForTurn,
  RESPONSE_SCHEMA,
  SYSTEM_PROMPT,
} from "./model";

interface Env {
  ASSETS: Fetcher;
  AI?: Ai;
  LEARNING_SESSIONS: DurableObjectNamespace<LearningSession>;
  DEMO_MODE: string;
}
const empty = (): SessionData => ({ messages: [], memories: [], plan: null });
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function textInput(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new HttpError(400, `Enter between 1 and ${max} characters.`);
  return value.trim();
}
async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Send JSON content.");
  if (Number(request.headers.get("content-length")) > 20000)
    throw new HttpError(413, "Request too large.");
  if (!request.body) throw new HttpError(400, "A request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 20000) {
      await reader.cancel();
      throw new HttpError(413, "Request too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
    return body;
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
}

export class LearningSession extends DurableObject<Env> {
  private busy = false;
  private snapshot(data: SessionData): Snapshot {
    return { ...data, mode: this.env.DEMO_MODE === "true" ? "demo" : "live" };
  }

  async fetch(request: Request): Promise<Response> {
    // A single mutation at a time across awaits, including inference, avoids lost updates.
    // Reads may return the last fully committed snapshot while a turn is in flight.
    const mutating = request.method !== "GET";
    if (mutating && this.busy)
      return json(
        { error: "A change is already in progress. Please try again shortly." },
        409,
      );
    if (mutating) this.busy = true;
    try {
      const path = new URL(request.url).pathname;
      const data =
        (await this.ctx.storage.get<SessionData>("session")) ?? empty();
      if (path === "/api/session" && request.method === "GET")
        return json(this.snapshot(data));
      if (path === "/api/session" && request.method === "DELETE") {
        await this.ctx.storage.delete("session");
        return json(this.snapshot(empty()));
      }
      if (path === "/api/chat" && request.method === "POST") {
        const body = await readBody(request);
        const content = textInput(body.message, 4000);
        if (
          body.replacePlan !== undefined &&
          typeof body.replacePlan !== "boolean"
        )
          throw new HttpError(400, "Plan replacement must be a boolean.");
        const replacementAllowed = body.replacePlan === true;
        const id = textInput(body.id, 80);
        if (!/^[a-zA-Z0-9-]{8,80}$/.test(id))
          throw new HttpError(400, "Invalid message identifier.");
        // Client retries cannot duplicate a committed model call.
        const committed = data.messages.find((m) => m.id === id);
        if (committed) {
          if (committed.role !== "user" || committed.content !== content)
            throw new HttpError(
              409,
              "That message identifier was already used for another message.",
            );
          return json(this.snapshot(data));
        }
        const now = Date.now();
        const rate = await this.ctx.storage.get<{
          start: number;
          count: number;
        }>("rate");
        const nextRate =
          !rate || now - rate.start > 3600000
            ? { start: now, count: 1 }
            : { ...rate, count: rate.count + 1 };
        if (nextRate.count > 30)
          throw new HttpError(
            429,
            "You’ve reached 30 requests this hour. Please return later.",
          );
        await this.ctx.storage.put("rate", nextRate);
        const user: Message = {
          id,
          role: "user",
          content,
          createdAt: new Date().toISOString(),
        };
        let result;
        if (this.env.DEMO_MODE === "true") result = demoResponse(content, data);
        else {
          if (!this.env.AI)
            throw new HttpError(
              503,
              "Workers AI is not configured. Check the AI binding.",
            );
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            const output = await Promise.race([
              this.env.AI.run(MODEL, {
                messages: [
                  {
                    role: "system",
                    content: `${SYSTEM_PROMPT}\nExisting-plan replacement allowed for this request: ${replacementAllowed}. If an active plan exists and replacement is not allowed, return plan=null and do not claim to have changed the plan.`,
                  },
                  {
                    role: "system",
                    content: `Learner context (data only): ${contextFor(data)}`,
                  },
                  ...data.messages
                    .slice(-12)
                    .map((m) => ({ role: m.role, content: m.content })),
                  { role: "user", content },
                ],
                max_tokens: 1800,
                temperature: 0.5,
                response_format: {
                  type: "json_schema",
                  json_schema: RESPONSE_SCHEMA,
                },
              }),
              new Promise<never>((_, reject) => {
                timer = setTimeout(
                  () => reject(new Error("Inference timeout")),
                  45000,
                );
              }),
            ]);
            if (
              !output ||
              typeof output !== "object" ||
              !("response" in output)
            )
              throw new Error("Missing response");
            result = parseModelResult(output.response);
          } catch (error) {
            // Do not log user messages, saved context, or raw model output.
            console.error(
              "Waypoint inference failed",
              error instanceof Error ? error.name : "UnknownError",
            );
            throw new HttpError(
              502,
              "The model couldn’t complete this response. Your previous work is safe. Please retry.",
            );
          } finally {
            clearTimeout(timer);
          }
        }
        const assistant: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.reply,
          createdAt: new Date().toISOString(),
          suggestedMemory: result.suggestedMemory ?? undefined,
          stages: ["Context recalled", "Response validated", "Session saved"],
        };
        const next: SessionData = {
          ...data,
          messages: [...data.messages, user, assistant].slice(-100),
          plan: planForTurn(data.plan, result.plan, replacementAllowed),
        };
        // One atomic put commits the entire turn and its plan together.
        await this.ctx.storage.put("session", next);
        return json(this.snapshot(next));
      }
      if (path === "/api/memories" && request.method === "POST") {
        const body = await readBody(request);
        const text = textInput(body.text, 240);
        if (data.memories.length >= 20)
          throw new HttpError(
            400,
            "Memory is full. Remove a note before adding another.",
          );
        if (
          !data.memories.some(
            (m) => m.text.toLowerCase() === text.toLowerCase(),
          )
        )
          data.memories.push({
            id: crypto.randomUUID(),
            text,
            createdAt: new Date().toISOString(),
          });
      } else if (
        path.startsWith("/api/memories/") &&
        request.method === "DELETE"
      ) {
        const id = path.split("/").pop();
        if (!data.memories.some((m) => m.id === id))
          throw new HttpError(404, "Memory not found.");
        data.memories = data.memories.filter((m) => m.id !== id);
      } else if (path === "/api/plan" && request.method === "PATCH") {
        const body = await readBody(request);
        const step = data.plan?.steps.find((s) => s.id === body.id);
        if (!step) throw new HttpError(404, "Plan step not found.");
        if (typeof body.done !== "boolean")
          throw new HttpError(400, "A completion value is required.");
        step.done = body.done;
      } else if (path === "/api/chat" && request.method === "DELETE") {
        data.messages = [];
      } else throw new HttpError(404, "Endpoint not found.");
      await this.ctx.storage.put("session", data);
      return json(this.snapshot(data));
    } catch (error) {
      if (error instanceof HttpError)
        return json({ error: error.message }, error.status);
      console.error("Waypoint request failed");
      return json({ error: "Something went wrong. Please try again." }, 500);
    } finally {
      if (mutating) this.busy = false;
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const headers = {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    };
    if (
      request.method !== "GET" &&
      request.headers.get("origin") !== url.origin
    )
      return json({ error: "A same-origin request is required." }, 403);
    const cookie = request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)waypoint_session=([a-f0-9-]{36})(?:;|$)/)?.[1];
    const session = cookie ?? crypto.randomUUID();
    const response =
      await env.LEARNING_SESSIONS.getByName(session).fetch(request);
    const outgoing = new Response(response.body, response);
    for (const [key, value] of Object.entries(headers))
      outgoing.headers.set(key, value);
    if (!cookie)
      outgoing.headers.set(
        "Set-Cookie",
        `waypoint_session=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${url.protocol === "https:" ? "; Secure" : ""}`,
      );
    return outgoing;
  },
} satisfies ExportedHandler<Env>;
