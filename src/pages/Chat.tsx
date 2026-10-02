import { AppSidebar } from "@/components/app-sidebar";
import { MarkdownView } from "@/components/MarkdownView";
import ModelChatSettings from "@/components/ModelChatSettings";
import ModelLoading from "@/components/ModelLoading";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore, useChatSettings } from "@/services/uiStore";
import type { Message } from "@/types/types";
import { Bot, Send, User } from "lucide-react";
import type { ProgressStatusInfo } from "node_modules/@huggingface/transformers/types/utils/core";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

function Chat() {
  const [streaming, setStreaming] = useState(false);
  // const [output, setOutput] = useState("");
  const [progress, setProgress] = useState<ProgressStatusInfo | null>(null);
  const [openProgress, setOpenProgress] = useState(false);
  const [streamThinking, setStreamThinking] = useState("");
  const [streamAnswer, setStreamAnswer] = useState("");

  const thinkMode = useRef<"none" | "thinking" | "final">("none");
  const messagesEndRef = useRef<HTMLDivElement>(null); // Added ref

  const worker = useRef<Worker | null>(null);

  const sessions = useAppStore((state) => state.sessions);
  const setSessions = useAppStore((state) => state.setSessions);
  const currentSession = useAppStore((state) => state.currentSession);
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const messages = useAppStore((state) => state.messages);
  const setMessages = useAppStore((state) => state.setMessages);
  const model = useChatSettings((state) => state.model);
  const appState = useAppStore((state) => state.appState);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamAnswer, streamThinking]);

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
          setProgress(e.data as ProgressStatusInfo);
          setOpenProgress(true);
          break;

        case "progress":
          setOpenProgress(true);
          setProgress(e.data as ProgressStatusInfo);
          break;

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
          setStreaming(true);

          let chunk = e.data.output as string;

          while (chunk.length) {
            if (thinkMode.current !== "thinking" && chunk.includes("<think>")) {
              const [before, after] = chunk.split("<think>", 2);
              setStreamAnswer((prev) => prev + before);
              thinkMode.current = "thinking";
              chunk = after;
              continue;
            }

            if (
              thinkMode.current === "thinking" &&
              chunk.includes("</think>")
            ) {
              const [inside, after] = chunk.split("</think>", 2);
              setStreamThinking((prev) => prev + inside);
              thinkMode.current = "final";
              chunk = after;
              continue;
            }

            if (thinkMode.current === "thinking") {
              setStreamThinking((prev) => prev + chunk);
            } else {
              setStreamAnswer((prev) => prev + chunk);
            }

            break;
          }

          break;
        }

        case "complete": {
          setOpenProgress(false);

          const full =
            (streamThinking ? `<think>${streamThinking}</think>\n` : "") +
            streamAnswer;

          setMessages([
            ...messages,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: full,
              sessionId: currentSession!.id,
              timestamp: Date.now(),
            },
          ]);

          setStreaming(false);
          setStreamThinking("");
          setStreamAnswer("");
          thinkMode.current = "none";
          break;
        }
      }
    };

    worker.current.addEventListener("message", onMessageReceived);

    return () => {
      if (worker.current)
        worker.current.removeEventListener("message", onMessageReceived);
    };
  }, [currentSession, messages, setMessages, streamAnswer, streamThinking]);

  function updateSessions(newSession: { id: string; name: string }) {
    setSessions([...sessions, newSession]);
  }

  function handleSend(message: string) {
    if (currentSession === null) {
      const newSession = {
        id: Date.now().toString(),
        name: message.slice(0, 20),
      };
      setCurrentSession(newSession);
      updateSessions(newSession);
      setSessions([...sessions, newSession]);
    }
    const newMessage: Message = {
      role: "user",
      content: message,
      id: Date.now().toString(),
      sessionId: currentSession ? currentSession.id : "unknown",
      timestamp: Date.now(),
    };
    setMessages([...messages, newMessage]);

    worker.current?.postMessage({
      type: "chat:message",
      messages: [...messages, newMessage],
    });
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

  return (
    <SidebarProvider className="flex h-dvh overflow-hidden">
      <AppSidebar className="h-full" />

      <main className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between border-b p-2.5">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="h-7 w-7" />
            <h1 className="text-sm font-medium">AI Chat</h1>
          </div>
          <div className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {model.label}
          </div>
        </header>

        <div
          role="log"
          aria-label="Conversation"
          className="flex-1 overflow-y-auto p-3 space-y-2"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[90%]  text-center py-8">
              <div className="mb-3 p-1.5 bg-primary/10 rounded-lg">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-base font-medium mb-0.5">
                Start a conversation
              </h2>
              <p className="text-muted-foreground max-w-md text-xs">
                Start a conversation below. The AI will show its reasoning
                process.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                const hasThinking = /<think>.*?<\/think>/s.test(msg.content);
                const thinkingContent = hasThinking
                  ? msg.content.match(/<think>(.*?)<\/think>/s)?.[1]?.trim() ||
                    ""
                  : "";
                const mainContent = msg.content
                  .replace(/<think>.*?<\/think>/s, "")
                  .trim();

                return (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role !== "user" && (
                      <div className="flex flex-col items-center mr-1.5 mt-0.5">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col max-w-[85%] gap-0.5">
                      {hasThinking && (
                        <div className="flex items-start gap-1.5 -mt-0.5">
                          <div className="bg-accent/60 border rounded-lg p-2 text-xs text-muted-foreground">
                            <Markdown>{thinkingContent}</Markdown>
                            <div className="text-right mt-0.5">
                              <span className="text-[10px] text-muted-foreground">
                                Reasoning
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div
                        className={`rounded-xl p-2.5 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground ml-auto"
                            : "bg-muted"
                        }`}
                      >
                        <MarkdownView docs={mainContent} />
                      </div>
                    </div>

                    {msg.role === "user" && (
                      <div className="ml-1.5 mt-0.5">
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                          <User className="h-3.5 w-3.5 text-secondary-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {streaming && (streamThinking || streamAnswer) && (
                <div className="flex  max-w-[85%] gap-1">
                  <div className="flex flex-col items-center mr-1.5 mt-0.5">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  </div>
                  <div className="flex flex-col max-w-[85%] gap-1">
                    {streamThinking && (
                      <div className="bg-accent/60 border rounded-lg p-2 text-xs text-muted-foreground animate-pulse motion-reduce:animate-none">
                        <Markdown>{streamThinking}</Markdown>
                      </div>
                    )}
                    {streamAnswer && (
                      <div className="bg-muted rounded-xl p-2.5 animate-pulse motion-reduce:animate-none">
                        <MarkdownView docs={streamAnswer} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <footer className="border-t p-2.5 bg-background/50">
          <ModelLoading
            progress={progress}
            open={openProgress}
            onOpenChange={setOpenProgress}
          />

          <div className="space-y-2 mt-1.5">
            <ModelChatSettings />

            <UserInput onSend={handleSend} />

            <div className="flex justify-between items-center text-xs text-muted-foreground px-0.5">
              <div>{model.label}</div>
              <div>⏎ send • ⇧+⏎ line</div>
            </div>
          </div>
        </footer>
      </main>
    </SidebarProvider>
  );
}

interface UserInputProps {
  onSend?: (message: string) => void;
}
function UserInput(props: UserInputProps) {
  const [input, setInput] = useState("");

  function handleSend() {
    if (props.onSend) {
      props.onSend(input);
    }
    setInput("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="relative w-full focus-within:ring-2 focus-within:ring-ring/50 rounded-xl border">
      <Textarea
        aria-label="Message"
        placeholder="Ask anything"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="min-h-[56px] max-h-48 resize-none border-0 pr-14 py-3 focus-visible:ring-0 focus-visible:ring-offset-0"
        autoFocus
      />
      <Button
        aria-label="Send message"
        onClick={handleSend}
        disabled={!input.trim()}
        size="icon"
        className="absolute right-3 bottom-3 h-9 w-9 rounded-lg"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
export default Chat;
