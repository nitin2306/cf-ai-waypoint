export interface PlanStep {
  id: string;
  title: string;
  description: string;
  done: boolean;
}
export interface Plan {
  title: string;
  steps: PlanStep[];
}
export interface Memory {
  id: string;
  text: string;
  createdAt: string;
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  suggestedMemory?: string;
  stages?: string[];
}
export interface SessionData {
  messages: Message[];
  memories: Memory[];
  plan: Plan | null;
}
export interface Snapshot extends SessionData {
  mode: "demo" | "live";
}
export interface ModelResult {
  reply: string;
  plan: {
    title: string;
    steps: { title: string; description: string }[];
  } | null;
  suggestedMemory: string | null;
}
