import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Feather,
  Flag,
  Layers3,
  Lightbulb,
  LoaderCircle,
  Map,
  MessageCircle,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { Snapshot } from "./types";
import "./styles.css";

type View = "chat" | "plan" | "memory";
const EMPTY: Snapshot = {
  messages: [],
  memories: [],
  plan: null,
  mode: "live",
};
const STARTERS = [
  {
    icon: Map,
    label: "Find my starting point",
    description: "Turn a big goal into small steps",
    prompt:
      "Make me a learning plan to build my first AI app with Cloudflare Workers. I have 30 minutes a day.",
  },
  {
    icon: Lightbulb,
    label: "Make it click",
    description: "Unpack a concept, simply",
    prompt:
      "Explain Durable Objects with a simple analogy and a small example.",
  },
  {
    icon: Layers3,
    label: "Put me to the test",
    description: "Find out what I really know",
    prompt:
      "Quiz me on what I have learned so far. If I have no learning plan yet, ask me what I want to practice.",
  },
];

function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`logo-mark ${small ? "small" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <path
          d="M20 4l5 11 11 5-11 5-5 11-5-11-11-5 11-5z"
          fill="currentColor"
        />
        <circle cx="20" cy="20" r="4" fill="var(--logo-hole, #7770ba)" />
      </svg>
    </span>
  );
}

async function api(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<Snapshot> {
  const response = await fetch(`/api/${path}`, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json()) as Snapshot & { error?: string };
  if (!response.ok)
    throw new Error(data.error ?? "Could not connect. Please try again.");
  return data;
}

function App() {
  const [data, setData] = useState(EMPTY);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [input, setInput] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [replacePlan, setReplacePlan] = useState(false);
  const [retry, setRetry] = useState<{ id: string; message: string } | null>(
    null,
  );
  const [modal, setModal] = useState<"about" | "reset" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      setError("");
      setData(await api("session"));
      setReady(true);
    } catch {
      setError(
        "Couldn’t connect to your workspace. Make sure the Worker is running, then reconnect.",
      );
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [data.messages.length, pending, view]);

  async function change(path: string, method: string, body?: unknown) {
    if (busy || !ready) return false;
    setBusy(true);
    setError("");
    try {
      setData(await api(path, method, body));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function send(message = input, existingId?: string) {
    if (!message.trim() || busy || !ready) return;
    const text = message.trim();
    const id = existingId ?? crypto.randomUUID();
    setView("chat");
    setBusy(true);
    setError("");
    setInput("");
    setPending(text);
    setRetry(null);
    try {
      setData(await api("chat", "POST", { id, message: text, replacePlan }));
      setReplacePlan(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setRetry({ id, message: text });
      setInput(text);
    } finally {
      setBusy(false);
      setPending("");
      composer.current?.focus();
    }
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "waypoint-workspace.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (await change("memories", "POST", { text: note })) setNote("");
  }
  async function toggleStep(id: string, done: boolean) {
    if (busy || !ready) return;
    const previous = data;
    setData((current) => ({
      ...current,
      plan: current.plan
        ? {
            ...current.plan,
            steps: current.plan.steps.map((step) =>
              step.id === id ? { ...step, done } : step,
            ),
          }
        : null,
    }));
    if (!(await change("plan", "PATCH", { id, done }))) setData(previous);
  }
  const done = data.plan?.steps.filter((s) => s.done).length ?? 0;
  const hasMessages = data.messages.length > 0 || !!pending;
  const progress = data.plan
    ? Math.round((done / data.plan.steps.length) * 100)
    : 0;

  function memoryList(compact = false) {
    return data.memories.length ? (
      <div className={`memory-list ${compact ? "compact" : ""}`}>
        {data.memories.map((memory) => (
          <div className="memory-item" key={memory.id}>
            <span className="memory-bullet" />
            <p>{memory.text}</p>
            <button
              className="icon-button delete-memory"
              aria-label={`Forget: ${memory.text}`}
              title="Forget this note"
              disabled={busy}
              onClick={() => void change(`memories/${memory.id}`, "DELETE")}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    ) : (
      <div className="empty-memory">
        <span className="empty-symbol">
          <Feather size={20} />
        </span>
        <p>
          A space for what makes
          <br />
          you, you.
        </p>
        <span>
          Save your goals and preferences.
          <br />
          I’ll keep them in mind as we go.
        </span>
      </div>
    );
  }
  function planList(compact = false) {
    if (!data.plan)
      return (
        <div className="empty-plan">
          <div className="path-doodle" aria-hidden="true">
            <span />
            <i />
            <span />
            <i />
            <span />
          </div>
          <p>Big goals. Small steps.</p>
          <span>
            Tell me what you want to learn.
            <br />
            We’ll find a path together.
          </span>
          <button
            className="text-button"
            disabled={!ready || busy}
            onClick={() => {
              setInput(STARTERS[0].prompt);
              setView("chat");
              composer.current?.focus();
            }}
          >
            Let’s make a plan <ArrowRight size={14} />
          </button>
        </div>
      );
    return (
      <>
        <p className="plan-title">{data.plan.title}</p>
        <div className="progress-label">
          <span>
            {done} of {data.plan.steps.length} steps complete
          </span>
          <span>{progress}%</span>
        </div>
        <div className="progress-track">
          <div style={{ width: `${progress}%` }} />
        </div>
        <div className={`plan-steps ${compact ? "compact" : ""}`}>
          {data.plan.steps.map((step, i) => (
            <label
              className={`plan-step ${step.done ? "completed" : ""}`}
              key={step.id}
            >
              <input
                type="checkbox"
                checked={step.done}
                disabled={busy}
                onChange={(e) => void toggleStep(step.id, e.target.checked)}
              />
              <span className="step-check">
                {step.done ? <Check size={12} /> : i + 1}
              </span>
              <span>
                <strong>{step.title}</strong>
                {!compact && <p>{step.description}</p>}
              </span>
            </label>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setView("chat");
          }}
        >
          <Logo />
          <span>
            waypoint<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="sidebar-caption">A LITTLE FURTHER, EVERY DAY</div>
        <button
          className="new-chat"
          disabled={busy || !ready}
          onClick={async () => {
            if (await change("chat", "DELETE")) {
              setView("chat");
              setInput("");
              setRetry(null);
              setReplacePlan(false);
            }
          }}
        >
          <Plus size={18} />
          New conversation<span>↗</span>
        </button>
        <div className="nav-caption">YOUR SPACE</div>
        <nav aria-label="Main navigation">
          {(
            [
              { id: "chat", label: "Conversation", icon: MessageCircle },
              { id: "plan", label: "Learning plan", icon: Map },
              { id: "memory", label: "Memory", icon: BookOpen },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => setView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === "memory" && data.memories.length > 0 && (
                <span className="nav-count">{data.memories.length}</span>
              )}
              {item.id === "chat" && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-spark">✧</span>
            <p>
              Progress isn’t always a straight line.
              <br />
              <strong>Curiosity is a good compass.</strong>
            </p>
            <div className="note-curve" />
          </div>
          <button className="sidebar-help" onClick={() => setModal("about")}>
            <CircleHelp size={17} />
            <span>How Waypoint works</span>
            <ArrowRight size={14} />
          </button>
          <div className="profile">
            <span className="profile-avatar">Y</span>
            <div>
              <strong>Your personal space</strong>
              <span>No account needed</span>
            </div>
            <span className="profile-status" />
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <span className="mobile-brand">
              <Logo small />
            </span>
            <span>Your workspace</span>
            <ChevronRight size={13} />
            <strong>
              {view === "chat"
                ? "Conversation"
                : view === "plan"
                  ? "Learning plan"
                  : "Memory"}
            </strong>
          </div>
          <div className="top-actions">
            <button
              className={`mode-badge ${!ready ? "connecting" : ""}`}
              onClick={() => setModal("about")}
            >
              <span />
              {!ready
                ? "Connecting"
                : data.mode === "demo"
                  ? "Local preview"
                  : "Workers AI connected"}
            </button>
            <button
              className="icon-button"
              aria-label="About Waypoint"
              onClick={() => setModal("about")}
            >
              <CircleHelp size={18} />
            </button>
          </div>
        </header>
        <div className="workspace-body">
          <main
            className={`main-content ${view !== "chat" ? "detail-content" : ""}`}
          >
            {error && (
              <div className="error-banner" role="alert">
                <span>{error}</span>
                {!ready ? (
                  <button onClick={() => void load()}>Reconnect</button>
                ) : retry ? (
                  <button
                    disabled={busy}
                    onClick={() => void send(retry.message, retry.id)}
                  >
                    Retry
                  </button>
                ) : (
                  <button
                    onClick={() => setError("")}
                    aria-label="Dismiss error"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}
            {view === "chat" ? (
              <>
                <div
                  className={`conversation-scroll ${hasMessages ? "has-messages" : ""}`}
                >
                  {!hasMessages ? (
                    <div className="welcome">
                      <div className="welcome-eyebrow">
                        <span />
                        YOUR AI LEARNING COMPANION
                      </div>
                      <div className="welcome-heading">
                        <h1>
                          A little curiosity.
                          <br />
                          <span>A world of possibility.</span>
                        </h1>
                        <div className="orbit-art" aria-hidden="true">
                          <div className="orbit orbit-one" />
                          <div className="orbit orbit-two" />
                          <div className="orbit orbit-three" />
                          <span className="orbit-center">✦</span>
                          <span className="orbit-point one" />
                          <span className="orbit-point two" />
                          <span className="orbit-star">✧</span>
                        </div>
                      </div>
                      <p className="welcome-description">
                        Bring your questions, your big ideas, your “I don’t get
                        it yet.”
                        <br className="desktop-break" /> We’ll turn them into
                        your next step, together.
                      </p>
                      <div className="start-label">WHERE SHALL WE BEGIN?</div>
                      <div className="starter-grid">
                        {STARTERS.map(({ icon: Icon, ...starter }, i) => (
                          <button
                            className={`starter-card starter-${i}`}
                            key={starter.label}
                            disabled={busy || !ready}
                            onClick={() => {
                              setInput(starter.prompt);
                              composer.current?.focus();
                            }}
                          >
                            <span className="starter-icon">
                              <Icon size={21} strokeWidth={1.6} />
                            </span>
                            <strong>{starter.label}</strong>
                            <span>{starter.description}</span>
                            <ArrowRight className="starter-arrow" size={17} />
                          </button>
                        ))}
                      </div>
                      <div className="welcome-footnote">
                        <span className="mini-spark">✧</span>
                        <span>
                          A companion that remembers where you’re headed.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="messages"
                      role="log"
                      aria-label="Conversation"
                    >
                      {data.messages.map((message) => (
                        <article
                          className={`message ${message.role}`}
                          key={message.id}
                        >
                          <span className="message-avatar">
                            {message.role === "assistant" ? (
                              <Logo small />
                            ) : (
                              "Y"
                            )}
                          </span>
                          <div className="message-body">
                            <div className="message-meta">
                              <strong>
                                {message.role === "assistant"
                                  ? "Waypoint"
                                  : "You"}
                              </strong>
                              <span>
                                {new Intl.DateTimeFormat(undefined, {
                                  hour: "numeric",
                                  minute: "2-digit",
                                }).format(new Date(message.createdAt))}
                              </span>
                            </div>
                            <div className="markdown">
                              <ReactMarkdown
                                components={{
                                  a: (props) => (
                                    <a
                                      {...props}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    />
                                  ),
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                            {message.suggestedMemory && (
                              <button
                                className="save-suggestion"
                                disabled={
                                  busy ||
                                  data.memories.some(
                                    (m) =>
                                      m.text.toLowerCase() ===
                                      message.suggestedMemory!.toLowerCase(),
                                  )
                                }
                                onClick={() =>
                                  void change("memories", "POST", {
                                    text: message.suggestedMemory,
                                  })
                                }
                              >
                                <BookOpen size={14} />
                                {data.memories.some(
                                  (m) =>
                                    m.text.toLowerCase() ===
                                    message.suggestedMemory!.toLowerCase(),
                                )
                                  ? "Saved to memory"
                                  : `Remember: ${message.suggestedMemory}`}
                              </button>
                            )}
                            {message.stages && (
                              <div className="turn-trace">
                                <Check size={12} />
                                {message.stages.join(" · ")}
                              </div>
                            )}
                          </div>
                        </article>
                      ))}
                      {pending && (
                        <>
                          <article className="message user">
                            <span className="message-avatar">Y</span>
                            <div className="message-body">
                              <div className="message-meta">
                                <strong>You</strong>
                                <span>Just now</span>
                              </div>
                              <p className="pending-text">{pending}</p>
                            </div>
                          </article>
                          <article className="message assistant">
                            <span className="message-avatar">
                              <Logo small />
                            </span>
                            <div className="thinking" role="status">
                              <LoaderCircle size={16} className="spin" />
                              Connecting the dots…
                              <small>
                                Recalling your context and shaping a response
                              </small>
                            </div>
                          </article>
                        </>
                      )}
                      <div ref={end} />
                    </div>
                  )}
                </div>
                <div className="composer-area">
                  <form
                    className="composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void send(
                        input,
                        retry?.message === input.trim() ? retry.id : undefined,
                      );
                    }}
                  >
                    <label className="sr-only" htmlFor="message-input">
                      Message Waypoint
                    </label>
                    <textarea
                      ref={composer}
                      id="message-input"
                      placeholder="What would you like to explore?"
                      value={input}
                      maxLength={4000}
                      rows={2}
                      disabled={busy || !ready}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          void send(
                            input,
                            retry?.message === input.trim()
                              ? retry.id
                              : undefined,
                          );
                        }
                      }}
                    />
                    {data.plan && (
                      <button
                        type="button"
                        className={`plan-permission ${replacePlan ? "enabled" : ""}`}
                        aria-pressed={replacePlan}
                        disabled={busy}
                        onClick={() => setReplacePlan((value) => !value)}
                        title="Enable when asking for a new plan. Replacing it resets existing progress."
                      >
                        <Map size={12} />
                        {replacePlan
                          ? "This message can replace your plan"
                          : "Replace learning plan with this message"}
                        {replacePlan && <Check size={12} />}
                      </button>
                    )}
                    <div className="composer-toolbar">
                      <span>
                        <Sparkles size={13} />
                        {data.memories.length
                          ? `${data.memories.length} saved ${data.memories.length === 1 ? "memory" : "memories"} in context`
                          : "A fresh perspective, with a memory"}
                      </span>
                      <div>
                        <span className="input-hint">
                          {input.length > 3500
                            ? `${input.length}/4000`
                            : "Enter to send"}
                        </span>
                        <button
                          className="send-button"
                          type="submit"
                          disabled={!input.trim() || busy || !ready}
                          aria-label="Send message"
                        >
                          {busy ? (
                            <LoaderCircle size={18} className="spin" />
                          ) : (
                            <ArrowUp size={19} />
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                  <p className="composer-disclaimer">
                    {data.mode === "demo" && ready
                      ? "Preview mode · Fixed example responses. Your workspace is saved locally by the Worker."
                      : "Powered by Llama 3.3 on Cloudflare · AI can make mistakes. Stay curious."}
                  </p>
                </div>
              </>
            ) : view === "plan" ? (
              <div className="detail-page">
                <div className="detail-eyebrow">
                  <Map size={17} />
                  ONE STEP AT A TIME
                </div>
                <h1>
                  Your learning plan<span>.</span>
                </h1>
                <p className="detail-subtitle">
                  A little direction for your next big thing.
                </p>
                <section className="detail-card">{planList()}</section>
                {data.plan && (
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => {
                      setView("chat");
                      setInput(
                        "Help me understand the next incomplete step in my learning plan.",
                      );
                    }}
                  >
                    <MessageCircle size={16} />
                    Talk through the next step
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            ) : (
              <div className="detail-page">
                <div className="detail-eyebrow">
                  <BookOpen size={17} />
                  CONTEXT THAT STAYS WITH YOU
                </div>
                <h1>
                  A little about you<span>.</span>
                </h1>
                <p className="detail-subtitle">
                  Your goals. Your pace. Your way of learning.
                </p>
                <section className="detail-card">
                  <h2>What I’ll keep in mind</h2>
                  <p className="card-description">
                    Saved notes are included in future conversations. You choose
                    what stays.
                  </p>
                  {memoryList()}
                  <form
                    className="memory-form"
                    onSubmit={(e) => void saveNote(e)}
                  >
                    <label htmlFor="memory-input">
                      Add a goal or preference
                    </label>
                    <textarea
                      id="memory-input"
                      placeholder="e.g. I learn best with examples, and I have 30 minutes a day."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={240}
                      rows={3}
                    />
                    <div>
                      <span>{note.length}/240</span>
                      <button
                        className="primary-button"
                        disabled={!note.trim() || busy || !ready}
                      >
                        <Plus size={15} />
                        Save memory
                      </button>
                    </div>
                  </form>
                </section>
                <div className="data-actions">
                  <button onClick={exportData} disabled={!ready}>
                    <ArrowDownToLine size={15} />
                    Export workspace
                  </button>
                  <button
                    onClick={() => setModal("reset")}
                    disabled={busy || !ready}
                  >
                    <Trash2 size={15} />
                    Erase workspace
                  </button>
                </div>
                <p className="privacy-note">
                  This browser’s private session keeps your workspace separate.
                  Clearing its cookie loses access. Removing a memory stops
                  future recall; it does not erase mentions in chat. Erase the
                  workspace to remove both.
                </p>
              </div>
            )}
            <footer className="main-footer">
              <span>MADE FOR THE CURIOUS</span>
              <span>
                Keep going. You’re getting somewhere. <Feather size={12} />
              </span>
            </footer>
          </main>

          <aside className="context-panel" aria-label="Your learning context">
            <div className="context-heading">
              <span>Your learning space</span>
              <Compass size={17} />
            </div>
            <section className="context-card">
              <div className="context-card-heading">
                <span className="context-icon lavender">
                  <Map size={17} />
                </span>
                <h2>The path ahead</h2>
                <button
                  className="icon-button"
                  aria-label="Open learning plan"
                  onClick={() => setView("plan")}
                >
                  <ArrowRight size={16} />
                </button>
              </div>
              {planList(true)}
            </section>
            <section className="context-card">
              <div className="context-card-heading">
                <span className="context-icon peach">
                  <BookOpen size={17} />
                </span>
                <h2>A little about you</h2>
                <span className="count-pill">{data.memories.length}</span>
              </div>
              {memoryList(true)}
              <button
                className="manage-memory"
                onClick={() => setView("memory")}
              >
                <Plus size={14} />{" "}
                {data.memories.length ? "Manage your memory" : "Add a memory"}
                <ChevronRight size={13} />
              </button>
            </section>
            <div className="memory-assurance">
              <span className="assurance-icon">
                <Check size={12} />
              </span>
              <p>
                Your progress has a home.
                <br />
                <strong>Pick up right where you left off.</strong>
              </p>
            </div>
            <div className="context-bottom">
              <span className="cloud-icon">☁</span> Built on Cloudflare
            </div>
          </aside>
        </div>
      </div>
      <dialog
        ref={dialog}
        className="modal"
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setModal(null);
        }}
      >
        <div className="modal-inner">
          <button
            className="icon-button modal-close"
            aria-label="Close dialog"
            onClick={() => setModal(null)}
          >
            <X size={20} />
          </button>
          {modal === "reset" ? (
            <>
              <span className="modal-icon">
                <RotateCcw size={25} />
              </span>
              <h2>A fresh start?</h2>
              <p>
                This erases your conversation, learning plan, and saved memories
                for this browser. This action cannot be undone.
              </p>
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  onClick={() => setModal(null)}
                >
                  Keep my workspace
                </button>
                <button
                  className="danger-button"
                  disabled={busy}
                  onClick={async () => {
                    if (await change("session", "DELETE")) {
                      setModal(null);
                      setInput("");
                      setNote("");
                      setRetry(null);
                      setReplacePlan(false);
                    }
                  }}
                >
                  Erase workspace
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="modal-icon">
                <Logo />
              </span>
              <h2>A companion with context.</h2>
              <p>
                Waypoint helps you learn one small step at a time. Your browser
                gets a private, anonymous workspace—no account needed.
              </p>
              <div className="architecture">
                <div>
                  <MessageCircle size={19} />
                  <strong>Ask a question</strong>
                  <span>A chat interface served by Cloudflare Workers.</span>
                </div>
                <ChevronRight size={16} />
                <div>
                  <Sparkles size={19} />
                  <strong>Connect the dots</strong>
                  <span>
                    Llama 3.3 reasons with your recent chat and saved context.
                  </span>
                </div>
                <ChevronRight size={16} />
                <div>
                  <BookOpen size={19} />
                  <strong>Keep growing</strong>
                  <span>
                    A Durable Object saves your conversation and plan.
                  </span>
                </div>
              </div>
              <div className="mode-explanation">
                <Flag size={17} />
                <p>
                  {data.mode === "demo" && ready ? (
                    <>
                      <strong>You’re in local preview.</strong> Responses are
                      fixed examples, not LLM output. Chat, memory, and progress
                      use real local Durable Object storage. Run the live
                      configuration with a Cloudflare account to enable Workers
                      AI.
                    </>
                  ) : (
                    <>
                      <strong>Built with Llama 3.3 + Workers AI.</strong> Only
                      memories you approve are saved. The latest 12 messages,
                      your plan, and saved notes provide model context. The
                      latest 100 messages are retained.
                    </>
                  )}
                </p>
              </div>
              <p className="modal-footnote">
                New conversation clears chat and keeps your plan and memory.
                <br />
                Manage or erase your saved context in the Memory tab.
              </p>
              <button
                className="primary-button modal-done"
                onClick={() => setModal(null)}
              >
                Let’s explore
                <ArrowRight size={15} />
              </button>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
