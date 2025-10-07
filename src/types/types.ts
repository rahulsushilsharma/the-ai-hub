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

export type { Message, Session };
