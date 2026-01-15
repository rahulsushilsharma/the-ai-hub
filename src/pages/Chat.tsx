import { AppSidebar } from "@/components/app-sidebar";
import { MarkdownView } from "@/components/MarkdownView";
import ModelChatSettings from "@/components/ModelChatSettings";
import ModelLoading from "@/components/ModelLoading";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore, useChatSettings } from "@/services/uiStore";
import type { Message } from "@/types/types";
import type { ProgressStatusInfo } from "@huggingface/transformers";
import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

// ====== TYPE DEFINITIONS ======
interface WorkerMessage {
  status: string;
  [key: string]: any;
}

interface ThinkingResponse {
  visible: boolean;
  content: string;
}

// ====== HELPER FUNCTIONS ======
const stripThinkingTags = (text: string): string =>
  text.replace(/<\/?think>/g, "").trim();

const isThinkingResponse = (content: string): boolean =>
  /<think>.*?<\/think>/s.test(content);

// ====== MAIN COMPONENT ======
function Chat() {
  // ====== STATE MANAGEMENT ======
  const [streaming, setStreaming] = useState(false);
  const [output, setOutput] = useState("");
  const [progress, setProgress] = useState<ProgressStatusInfo | null>(null);
  const [openProgress, setOpenProgress] = useState(false);
  const [thinking, setThinking] = useState<ThinkingResponse>({
    visible: false,
    content: "",
  });

  const worker = useRef<Worker | null>(null);

  // Store selectors
  const sessions = useAppStore((state) => state.sessions);
  const setSessions = useAppStore((state) => state.setSessions);
  const currentSession = useAppStore((state) => state.currentSession);
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const messages = useAppStore((state) => state.messages);
  const setMessages = useAppStore((state) => state.setMessages);
  const model = useChatSettings((state) => state.model);
  const appState = useAppStore((state) => state.appState);

  // ====== EFFECTS ======
  // Model switching effect
  useEffect(() => {
    if (worker.current && !appState.settingsOpen && model.value) {
      worker.current.postMessage({
        type: "chat:switchModel",
        model: model.value,
      });
      console.log("Model updated to:", model.value);
    }
  }, [appState.settingsOpen, model.value]);

  // Worker initialization effect
  useEffect(() => {
    if (worker.current) return;

    worker.current = new Worker(
      new URL("../workers/chatWorker.ts", import.meta.url),
      { type: "module" }
    );

    const handleMessage = (e: MessageEvent<WorkerMessage>) => {
      const data = e.data;

      switch (data.status) {
        case "initiate":
        case "progress":
        case "done":
          setProgress(data);
          setOpenProgress(true);
          break;

        case "ready":
          setOpenProgress(false);
          setProgress(data);
          break;

        case "thinking":
          // Process thinking response if present in content
          if (data.content && isThinkingResponse(data.content)) {
            const thinkingContent = stripThinkingTags(data.content);
            setThinking({
              visible: true,
              content: thinkingContent,
            });
          }
          break;

        case "update":
          setOutput((prev) => prev + data.output);
          setStreaming(true);
          break;

        case "complete":
          setMessages(data.output.generated_text);
          setStreaming(false);
          setOutput("");
          setThinking({ visible: false, content: "" });
          setOpenProgress(false);
          break;
      }
    };

    worker.current.addEventListener("message", handleMessage);
    return () => worker.current?.removeEventListener("message", handleMessage);
  }, [setMessages]);

  // Local storage effects
  useEffect(() => {
    const savedSessions = localStorage.getItem("chat-sessions");
    if (savedSessions) setSessions(JSON.parse(savedSessions));
  }, [setSessions]);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("chat-sessions", JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    if (!currentSession) {
      setMessages([]);
      return;
    }

    const savedMessages = localStorage.getItem(
      `chat-messages:${currentSession.id}`
    );
    if (savedMessages) setMessages(JSON.parse(savedMessages));
  }, [currentSession, setMessages]);

  useEffect(() => {
    if (currentSession && messages.length > 0) {
      localStorage.setItem(
        `chat-messages:${currentSession.id}`,
        JSON.stringify(messages)
      );
    }
  }, [messages, currentSession]);

  // ====== HANDLERS ======
  const updateSessions = useCallback(
    (newSession: { id: string; name: string }) => {
      setSessions((prev) => [...prev, newSession]);
    },
    [setSessions]
  );

  const handleSend = useCallback(
    (message: string) => {
      if (!message.trim()) return;

      // Create new session if none exists
      if (!currentSession) {
        const newSession = {
          id: Date.now().toString(),
          name: message.slice(0, 20) || "New Chat",
        };
        setCurrentSession(newSession);
        updateSessions(newSession);
      }

      // Add user message
      const newMessage: Message = {
        role: "user",
        content: message,
        id: Date.now().toString(),
        sessionId: currentSession?.id || "unknown",
        timestamp: Date.now(),
      };

      setMessages((prev: any) => [...prev, newMessage]);

      // Send to worker
      worker.current?.postMessage({
        type: "chat:message",
        messages: [...messages, newMessage],
      });
    },
    [currentSession, messages, updateSessions, setCurrentSession, setMessages]
  );

  // ====== RENDER ======
  return (
    <SidebarProvider>
      <AppSidebar className="h-[100dvh]" />
      <main className="flex flex-col h-screen p-4">
        <SidebarTrigger className="mb-4" />

        <div className="flex flex-col flex-1 gap-4 overflow-hidden">
          <ChatMessages
            messages={messages}
            output={output}
            streaming={streaming}
            thinking={thinking}
          />

          <div className="mt-auto space-y-4">
            <ModelLoading
              progress={progress}
              open={openProgress}
              onOpenChange={setOpenProgress}
            />

            <ModelChatSettings />

            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">{model.label}</p>
              <UserInput onSend={handleSend} />
            </div>
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
}

// ====== SUBCOMPONENTS ======
interface UserInputProps {
  onSend: (message: string) => void;
}

function UserInput({ onSend }: UserInputProps) {
  const [input, setInput] = useState("");

  const handleSend = useCallback(() => {
    if (input.trim()) {
      onSend(input);
      setInput("");
    }
  }, [input, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="relative w-full focus-within:ring-2 focus-within:ring-ring/50 rounded-lg border">
      <Textarea
        placeholder="Message AI..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="min-h-[48px] max-h-48 resize-none border-0 pr-14 py-3 focus-visible:ring-0 focus-visible:ring-offset-0"
        autoFocus
      />
      <Button
        onClick={handleSend}
        disabled={!input.trim()}
        size="icon"
        className="absolute right-2 top-2 h-8 w-8"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface ChatMessagesProps {
  messages: Message[];
  output: string;
  streaming?: boolean;
  thinking: ThinkingResponse;
}

function ChatMessages({
  messages,
  output,
  streaming,
  thinking,
}: ChatMessagesProps) {
  return (
    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
      {messages.length === 0 ? (
        <WelcomeMessage />
      ) : (
        <>
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {/* Thinking visualization */}
          {thinking.visible && thinking.content && (
            <ThinkingBubble content={thinking.content} />
          )}

          {/* Streaming response */}
          {streaming && output && (
            <div className="ml-auto max-w-[85%] bg-muted rounded-2xl p-4 animate-fade-in">
              <MarkdownView docs={output} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WelcomeMessage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="mb-6 bg-gradient-to-r from-primary/20 to-secondary/20 text-primary rounded-2xl p-3">
        <Send className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Welcome to AI Playground</h2>
      <p className="text-muted-foreground max-w-md">
        Start a conversation by typing a message below. The AI will respond with
        both its reasoning process and final answer.
      </p>
    </div>
  );
}

interface ChatMessageProps {
  message: Message;
}

function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl p-4 ${
          isUser ? "bg-primary text-primary-foreground ml-auto" : "bg-muted"
        }`}
      >
        <div className="font-medium mb-1">{isUser ? "You" : "AI"}</div>
        <div className="prose prose-sm max-w-none">
          <Markdown>{message.content}</Markdown>
        </div>
      </div>
    </div>
  );
}

interface ThinkingBubbleProps {
  content: string;
}

function ThinkingBubble({ content }: ThinkingBubbleProps) {
  return (
    <div className="animate-fade-in">
      <div className="flex items-start mb-2">
        <div className="bg-blue-500/10 text-blue-500 rounded-full p-1 mr-2 mt-1">
          💭
        </div>
        <div className="font-medium text-blue-600 dark:text-blue-400">
          AI Reasoning Process
        </div>
      </div>

      <div className="bg-blue-50/50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 ml-8">
        <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
          {content}
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground mt-2">
        (The AI analyzes the question before formulating its response)
      </div>
    </div>
  );
}

export default Chat;
