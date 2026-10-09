import { AppSidebar } from "@/components/app-sidebar";
import { CopyButton } from "@/components/CopyButton";
import { MarkdownView } from "@/components/MarkdownView";
import ModelChatSettings from "@/components/ModelChatSettings";
import ModelLoading from "@/components/ModelLoading";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore, useChatSettings } from "@/services/uiStore";
import type { Message } from "@/types/types";
import {
  ArrowDown,
  Bot,
  ChevronRight,
  RefreshCw,
  Send,
  Square,
  User,
} from "lucide-react";
import type { ProgressStatusInfo } from "node_modules/@huggingface/transformers/types/utils/core";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

const SUGGESTIONS = [
  "Explain how a transformer model works",
  "Write a Python function to debounce calls",
  "Give me 3 ideas for a weekend project",
  "Summarize the pros and cons of running AI in the browser",
];

const stripThink = (t: string) => t.replace(/<think>.*?<\/think>/s, "").trim();

function Chat() {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressStatusInfo | null>(null);
  const [openProgress, setOpenProgress] = useState(false);
  const [streamThinking, setStreamThinking] = useState("");
  const [streamAnswer, setStreamAnswer] = useState("");
  const [showJump, setShowJump] = useState(false);

  const thinkMode = useRef<"none" | "thinking" | "final">("none");
  // mirrors of the stream state so the worker listener can register once
  const thinkingBuf = useRef("");
  const answerBuf = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // follow the stream only while user is at the bottom

  const worker = useRef<Worker | null>(null);

  const sessions = useAppStore((state) => state.sessions);
  const setSessions = useAppStore((state) => state.setSessions);
  const currentSession = useAppStore((state) => state.currentSession);
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const messages = useAppStore((state) => state.messages);
  const setMessages = useAppStore((state) => state.setMessages);
  const setAppState = useAppStore((state) => state.setAppState);
  const model = useChatSettings((state) => state.model);
  const appState = useAppStore((state) => state.appState);

  function scrollToBottom(behavior: ScrollBehavior = "auto") {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stick.current = near;
    setShowJump(!near);
  }

  useEffect(() => {
    if (stick.current) scrollToBottom();
  }, [messages, streamAnswer, streamThinking, generating]);

  useEffect(() => {
    if (worker.current && !appState.settingsOpen) {
      worker.current.postMessage({
        type: "chat:switchModel",
        model: model.value,
      });
    }
  }, [appState.settingsOpen, model.value]);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(
        new URL("../workers/chatWorker.ts", import.meta.url),
        {
          type: "module",
        }
      );
    }

    const onMessageReceived = (e: MessageEvent) => {
      switch (e.data.status) {
        case "initiate":
        case "progress":
        case "done":
          setOpenProgress(true);
          setProgress(e.data as ProgressStatusInfo);
          break;

        case "ready":
          setOpenProgress(false);
          setProgress(e.data as ProgressStatusInfo);
          break;

        case "update": {
          setOpenProgress(false);

          let chunk = e.data.output as string;

          while (chunk.length) {
            if (thinkMode.current !== "thinking" && chunk.includes("<think>")) {
              const [before, after] = chunk.split("<think>", 2);
              answerBuf.current += before;
              thinkMode.current = "thinking";
              chunk = after;
              continue;
            }

            if (
              thinkMode.current === "thinking" &&
              chunk.includes("</think>")
            ) {
              const [inside, after] = chunk.split("</think>", 2);
              thinkingBuf.current += inside;
              thinkMode.current = "final";
              chunk = after;
              continue;
            }

            if (thinkMode.current === "thinking") {
              thinkingBuf.current += chunk;
            } else {
              answerBuf.current += chunk;
            }

            break;
          }

          setStreamThinking(thinkingBuf.current);
          setStreamAnswer(answerBuf.current);
          break;
        }

        case "complete": {
          setOpenProgress(false);

          const thinking = thinkingBuf.current;
          const answer = answerBuf.current;
          const { messages, currentSession, setMessages } =
            useAppStore.getState();

          // empty when stopped before the first token
          if ((thinking || answer) && currentSession) {
            setMessages([
              ...messages,
              {
                id: Date.now().toString(),
                role: "assistant",
                content:
                  (thinking ? `<think>${thinking}</think>\n` : "") + answer,
                sessionId: currentSession.id,
                timestamp: Date.now(),
              },
            ]);
          }

          setGenerating(false);
          setStreamThinking("");
          setStreamAnswer("");
          thinkingBuf.current = "";
          answerBuf.current = "";
          thinkMode.current = "none";
          break;
        }
      }
    };

    const w = worker.current;
    w.addEventListener("message", onMessageReceived);

    return () => {
      w.removeEventListener("message", onMessageReceived);
    };
  }, []);

  function generate(history: Message[]) {
    stick.current = true;
    setGenerating(true);
    worker.current?.postMessage({
      type: "chat:message",
      // model has no use for its own earlier reasoning
      messages: history.map((m) => ({ ...m, content: stripThink(m.content) })),
      settings: useChatSettings.getState().settings,
    });
  }

  function handleSend(text: string) {
    const message = text.trim();
    if (!message || generating) return;

    let session = currentSession;
    if (session === null) {
      session = { id: Date.now().toString(), name: message.slice(0, 20) };
      setCurrentSession(session);
      setSessions([...sessions, session]);
    }
    const newMessage: Message = {
      role: "user",
      content: message,
      id: Date.now().toString(),
      sessionId: session.id,
      timestamp: Date.now(),
    };
    const history = [...messages, newMessage];
    setMessages(history);
    generate(history);
  }

  function handleStop() {
    worker.current?.postMessage({ type: "chat:stop" });
  }

  function handleRegenerate() {
    if (generating || messages.at(-1)?.role !== "assistant") return;
    const history = messages.slice(0, -1);
    setMessages(history);
    generate(history);
  }

  function localSessions() {
    const sessions = localStorage.getItem("chat-sessions");
    if (sessions) {
      return JSON.parse(sessions);
    }
  }

  function localMessages(currentSession: { id: string; name: string } | null) {
    const messages = localStorage.getItem(
      "chat-messages:" + currentSession?.id
    );
    if (messages) {
      return JSON.parse(messages);
    }
  }

  useEffect(() => {
    const savedSessions = localSessions();
    if (savedSessions) {
      setSessions(savedSessions);
    }
  }, [setSessions]);

  useEffect(() => {
    if (sessions.length > 0)
      localStorage.setItem("chat-sessions", JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (currentSession) {
      const savedMessages = localMessages(currentSession);

      if (savedMessages) {
        setMessages(savedMessages);
      }
    } else {
      setMessages([]);
    }
  }, [currentSession, setMessages]);

  useEffect(() => {
    if (currentSession) {
      localStorage.setItem(
        "chat-messages:" + currentSession.id,
        JSON.stringify(messages)
      );
    }
  }, [messages, currentSession]);

  const lastId = messages.at(-1)?.id;
  const waiting =
    generating && !streamThinking && !streamAnswer && !openProgress;

  return (
    <SidebarProvider className="flex h-dvh overflow-hidden">
      <AppSidebar className="h-full" />

      <main className="relative flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between border-b p-2.5">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="h-7 w-7" />
            <h1 className="text-sm font-medium">AI Chat</h1>
          </div>
          <button
            type="button"
            onClick={() => setAppState({ settingsOpen: true })}
            title="Chat settings"
            className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
          >
            {model.label}
          </button>
        </header>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          role="log"
          aria-label="Conversation"
          className="flex-1 overflow-y-auto p-3 space-y-3"
        >
          {messages.length === 0 && !generating ? (
            <div className="flex flex-col items-center justify-center min-h-full text-center py-8">
              <div className="mb-3 p-1.5 bg-primary/10 rounded-lg">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-base font-medium mb-0.5">
                Start a conversation
              </h2>
              <p className="text-muted-foreground max-w-md text-xs">
                Runs fully in your browser. The first message downloads the
                model; it is cached after that.
              </p>
              <div className="mt-5 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSend(q)}
                    className="rounded-lg border bg-card px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) =>
                msg.role === "user" ? (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-xl bg-primary p-2.5 text-primary-foreground whitespace-pre-wrap break-words">
                      {msg.content}
                    </div>
                    <div className="ml-1.5 mt-0.5">
                      <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-secondary-foreground" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <AssistantMessage
                    key={msg.id}
                    content={msg.content}
                    onRegenerate={
                      msg.id === lastId && !generating
                        ? handleRegenerate
                        : undefined
                    }
                  />
                )
              )}

              {generating && (
                <AssistantMessage
                  content={
                    (streamThinking ? `<think>${streamThinking}</think>` : "") +
                    streamAnswer
                  }
                  streaming
                  waiting={waiting}
                />
              )}
            </>
          )}
        </div>

        {showJump && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              stick.current = true;
              setShowJump(false);
              scrollToBottom("smooth");
            }}
            className="absolute bottom-36 left-1/2 -translate-x-1/2 rounded-full shadow-md"
          >
            <ArrowDown className="h-3.5 w-3.5" /> Latest
          </Button>
        )}

        <footer className="border-t p-2.5 bg-background/50">
          <ModelLoading
            progress={progress}
            open={openProgress}
            onOpenChange={setOpenProgress}
          />

          <div className="space-y-2 mt-1.5">
            <ModelChatSettings />

            <UserInput
              onSend={handleSend}
              onStop={handleStop}
              generating={generating}
            />

            <div className="text-right text-xs text-muted-foreground px-0.5">
              ⏎ send • ⇧+⏎ line
            </div>
          </div>
        </footer>
      </main>
    </SidebarProvider>
  );
}

function AssistantMessage({
  content,
  streaming = false,
  waiting = false,
  onRegenerate,
}: {
  content: string;
  streaming?: boolean;
  waiting?: boolean;
  onRegenerate?: () => void;
}) {
  const thinking = content.match(/<think>(.*?)<\/think>/s)?.[1]?.trim() ?? "";
  const answer = stripThink(content);

  return (
    <div className="group flex justify-start">
      <div className="flex flex-col items-center mr-1.5 mt-0.5">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
      </div>

      <div className="flex min-w-0 max-w-[85%] flex-col gap-1">
        {thinking && (
          <Collapsible defaultOpen={streaming}>
            <CollapsibleTrigger className="group/think flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded">
              <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]/think:rotate-90" />
              Reasoning
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 rounded-lg border bg-accent/60 p-2 text-xs text-muted-foreground">
              <Markdown>{thinking}</Markdown>
            </CollapsibleContent>
          </Collapsible>
        )}

        {waiting ? (
          <div
            className="flex items-center gap-1 rounded-xl bg-muted px-3 py-3"
            role="status"
            aria-label="Thinking"
          >
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                style={{ animationDelay: `${d}ms` }}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : (
          answer && (
            <div className="rounded-xl bg-muted p-2.5 break-words">
              <MarkdownView docs={answer} />
              {streaming && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/60 align-middle motion-reduce:animate-none" />
              )}
            </div>
          )
        )}

        {!streaming && answer && (
          <div
            className={`flex gap-0.5 text-muted-foreground transition-opacity focus-within:opacity-100 ${
              onRegenerate ? "" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <CopyButton getText={() => answer} label="Copy reply" />
            {onRegenerate && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label="Regenerate reply"
                title="Regenerate reply"
                onClick={onRegenerate}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface UserInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  generating: boolean;
}
function UserInput({ onSend, onStop, generating }: UserInputProps) {
  const [input, setInput] = useState("");

  function handleSend() {
    if (!input.trim() || generating) return;
    onSend(input);
    setInput("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="relative w-full focus-within:ring-2 focus-within:ring-ring/50 rounded-xl border">
      <Textarea
        aria-label="Message"
        placeholder={
          generating ? "Generating… you can type your next message" : "Ask anything"
        }
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="field-sizing-content min-h-[56px] max-h-48 resize-none border-0 pr-14 py-3 focus-visible:ring-0 focus-visible:ring-offset-0"
        autoFocus
      />
      {generating ? (
        <Button
          aria-label="Stop generating"
          title="Stop generating"
          onClick={onStop}
          size="icon"
          variant="secondary"
          className="absolute right-3 bottom-3 h-9 w-9 rounded-lg"
        >
          <Square className="h-4 w-4 fill-current" />
        </Button>
      ) : (
        <Button
          aria-label="Send message"
          onClick={handleSend}
          disabled={!input.trim()}
          size="icon"
          className="absolute right-3 bottom-3 h-9 w-9 rounded-lg"
        >
          <Send className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
export default Chat;
