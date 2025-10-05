import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

function Chat() {
  const [ready, setReady] = useState(false);
  const [disabled, setDisabled] = useState(false);
  type ProgressItem = { file: string; progress?: number; status?: string };
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);

  // Inputs and outputs
  const [streaming, setStreaming] = useState(false);
  const [output, setOutput] = useState("");

  const worker = useRef<Worker | null>(null);

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
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
          setReady(false);
          setProgressItems((prev) => [...prev, e.data]);
          break;

        case "progress":
          setProgressItems((prev) =>
            prev.map((item) => {
              if (item.file === e.data.file) {
                return { ...item, progress: e.data.progress };
              }
              return item;
            })
          );
          break;

        case "done":
          setProgressItems((prev) =>
            prev.filter((item) => item.file !== e.data.file)
          );
          break;

        case "ready":
          setReady(true);
          break;

        case "update":
          setOutput((prev) => prev + e.data.output);
          setStreaming(true);
          break;

        case "complete":
          setMessages(e.data.output.generated_text);
          setDisabled(false);
          setStreaming(false);
          setOutput("");
          break;
      }
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener("message", onMessageReceived);

    // Define a cleanup function for when the component is unmounted.
    return () => {
      if (worker.current)
        worker.current.removeEventListener("message", onMessageReceived);
    };
  }, []);

  const testMessages: Message[] = [
    { role: "user", content: "Hello, how are you?" },
    {
      role: "assistant",
      content: "I'm good, thank you! How can I assist you?",
    },
    { role: "user", content: "Can you tell me a joke?" },
    {
      role: "assistant",
      content:
        "Sure! Why don't scientists trust atoms? Because they make up everything!",
    },
  ];

  const testSessions = [
    { id: "1", name: "Session 1" },
    { id: "2", name: "Session 2" },
  ];
  const [messages, setMessages] = useState<Message[]>(testMessages);
  const [sessions, setSessions] =
    useState<{ id: string; name: string }[]>(testSessions);
  const [currentSession, setCurrentSession] = useState<{
    id: string;
    name: string;
  } | null>(null);

  function updateSessions(newSession: { id: string; name: string }) {
    setSessions((prevSessions) => [...prevSessions, newSession]);
  }

  function updateMessages(newMessage: Message) {
    setMessages((prevMessages) => [...prevMessages, newMessage]);
  }

  function handleSend(message: string) {
    if (currentSession === null) {
      const newSession = {
        id: Date.now().toString(),
        name: message.slice(0, 20),
      };
      setCurrentSession(newSession);
      updateSessions(newSession);
      saveSessions([...sessions, newSession]);
    }
    const newMessage: Message = { role: "user", content: message };
    updateMessages(newMessage);

    worker.current?.postMessage({
      type: "chat:message",
      messages: [...messages, newMessage],
    });
  }

  function saveSessions(sessions: { id: string; name: string }[]) {
    localStorage.setItem("chat-sessions", JSON.stringify(sessions));
  }

  function handleSessionChange(sessionId: { id: string; name: string }) {
    setCurrentSession(sessionId);
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
  }, []);

  useEffect(() => {
    if (currentSession) {
      const savedMessages = localMessages(currentSession);
      console.log(
        "Loaded messages for session",
        currentSession.id,
        savedMessages
      );
      if (savedMessages) {
        setMessages(savedMessages);
      } else {
        setMessages([]);
      }
    }
  }, [currentSession]);

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
          <AppSidebar
            sessions={sessions}
            currentSession={currentSession}
            onSessionChange={handleSessionChange}
          />
          <SidebarTrigger />
          <div className="p-4 w-full h-screen flex flex-col gap-4 justify-between">
            <UserChat
              messages={messages}
              output={output}
              streaming={streaming}
            />
            {JSON.stringify(progressItems)}
            {JSON.stringify(ready)}
            {JSON.stringify(disabled)}
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
    // Implement send functionality here
    console.log("Send button clicked");
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

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}
function UserChat(props: {
  messages?: Message[];
  output: string;
  streaming?: boolean;
}) {
  return (
    <div className="flex-1 overflow-y-auto mb-4 h-fit pr-2">
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
    </div>
  );
}
export default Chat;
