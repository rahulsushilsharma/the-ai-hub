import { AppSidebar } from "@/components/app-sidebar";
import ModelChatSettings from "@/components/ModelChatSettings";
import ModelLoading from "@/components/ModelLoading";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore, useChatSettings } from "@/services/uiStore";
import type { Message } from "@/types/types";
import { Send } from "lucide-react";
import type { ProgressStatusInfo } from "node_modules/@huggingface/transformers/types/utils/core";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

function Chat() {
  // Inputs and outputs
  const [streaming, setStreaming] = useState(false);
  const [output, setOutput] = useState("");
  const [progress, setProgress] = useState<ProgressStatusInfo | null>(null);
  const [openProgress, setOpenProgress] = useState(false);

  const worker = useRef<Worker | null>(null);

  const sessions = useAppStore((state) => state.sessions);
  const setSessions = useAppStore((state) => state.setSessions);
  const currentSession = useAppStore((state) => state.currentSession);
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const messages = useAppStore((state) => state.messages);
  const setMessages = useAppStore((state) => state.setMessages);
  const model = useChatSettings((state) => state.model);
  const appState = useAppStore((state) => state.appState);

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
          setOpenProgress(true);
          setProgress(e.data as ProgressStatusInfo);
          break;

        case "update":
          setOpenProgress(false);
          setOutput((prev) => prev + e.data.output);
          setStreaming(true);
          break;

        case "complete":
          setOpenProgress(false);
          setMessages(e.data.output.generated_text);
          setStreaming(false);
          setOutput("");
          break;
      }
    };

    worker.current.addEventListener("message", onMessageReceived);

    return () => {
      if (worker.current)
        worker.current.removeEventListener("message", onMessageReceived);
    };
  }, [setMessages]);

  function updateSessions(newSession: { id: string; name: string }) {
    setSessions([...sessions, newSession]);
  }

  function updateMessages(newMessage: Message) {
    setMessages([...messages, newMessage]);
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
    updateMessages(newMessage);

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

      setMessages(savedMessages);
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
    <>
      {" "}
      <div>
        <SidebarProvider>
          <AppSidebar />
          <SidebarTrigger />
          <div className="p-4 w-full h-screen flex flex-col gap-4 justify-between">
            <UserChat
              messages={messages}
              output={output}
              streaming={streaming}
            />

            <ModelLoading
              progress={progress}
              open={openProgress}
              onOpenChange={setOpenProgress}
            />
            <ModelChatSettings />
            <UserInput onSend={handleSend} />
          </div>
        </SidebarProvider>
      </div>
    </>
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
    <div className="w-full flex flex-col gap-2 md:flex-row focus-within:ring-2 focus-within:ring-secondary focus-within:ring-offset-2 focus-within:ring-offset-background p-4 rounded-md border border-input">
      <Textarea
        placeholder="Type your text here..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full max-h-40 min-h-10 border-0 resize-none focus-visible:ring-0 focus-visible:outline-none focus-visible:shadow-none focus-visible:border-0"
      />
      <div className="flex justify-end flex-col">
        <Button onClick={handleSend} className="ml-2 " disabled={!input.trim()}>
          <Send />
        </Button>
      </div>
    </div>
  );
}

function UserChat(props: {
  messages?: Message[];
  output: string;
  streaming?: boolean;
}) {
  return (
    <div className="flex-1 overflow-y-auto mb-4 h-fit pr-2">
      {props.messages === undefined || props.messages.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-full">
          <p className="text-muted-foreground">
            Welcome to the chat Playground – start by typing a message!
          </p>
        </div>
      ) : (
        <>
          {props.messages?.map((msg, index) => (
            <div
              key={index}
              className={`${
                msg.role === "user" ? "flex-row-reverse" : ""
              } flex justify-startgap-2 mb-2 items-center`}
            >
              <div>
                <b>{msg.role === "user" ? "You" : "AI"}</b>
              </div>
              <div
                key={index}
                className={` ${
                  msg.role === "user" ? "shadow " : "bg-muted"
                } p-4 rounded-lg mb-2 max-w-lg ${
                  msg.role === "user" ? "ml-auto" : ""
                }`}
              >
                <div className="chat-message-content">
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>
            </div>
          ))}
          {props.streaming && (
            <div className="flex justify-start gap-2 mb-2 items-center">
              <div>
                <b>AI</b>
              </div>
              <div className="bg-muted p-4 rounded-lg mb-2 max-w-lg">
                <div className="chat-message-content">
                  <Markdown>{props.output}</Markdown>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
export default Chat;
