interface Session {
  id: string;
  name: string;
}

interface Message {
  role?: "user" | "assistant" | "system";
  id: string;
  sessionId: string;
  content: string;
  timestamp: number;
}

interface Model {
  label: string;
  value: string;
  type: "local" | "api";
  device?: "cpu" | "webgl" | "webgpu";
  dtype?: "fp16" | "fp32" | "q4f16";
  loaded?: boolean;
}

interface ChatSettings {
  temperature: number;
  top_p: number;
  presence_penalty: number;
  frequency_penalty: number;
  max_new_tokens: number;
  stream: boolean;
}

export type { ChatSettings, Message, Model, Session };
