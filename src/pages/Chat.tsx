import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function Chat() {
  const [ready, setReady] = useState(false);
  const [disabled, setDisabled] = useState(false);
  type ProgressItem = { file: string; progress?: number; status?: string };
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);

  // Inputs and outputs
  const [output, setOutput] = useState("");

  const worker = useRef<Worker | null>(null);

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
      worker.current = new Worker(
        new URL("./workers/worker.ts", import.meta.url),
        {
          type: "module",
        }
      );
    }

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = (e: MessageEvent) => {
      switch (e.data.status) {
        case "initiate":
          // Model file start load: add a new progress item to the list.
          setReady(false);
          setProgressItems((prev) => [...prev, e.data]);
          break;

        case "progress":
          // Model file progress: update one of the progress items.
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
          // Model file loaded: remove the progress item from the list.
          setProgressItems((prev) =>
            prev.filter((item) => item.file !== e.data.file)
          );
          break;

        case "ready":
          // Pipeline ready: the worker is ready to accept messages.
          setReady(true);
          break;

        case "update":
          // Generation update: update the output text.
          console.log(e.data.output);
          setOutput(e.data.output[0].translation_text);
          break;

        case "complete":
          // Generation complete: re-enable the "Translate" button
          setOutput(e.data.output[0].translation_text);
          console.log(e.data.output[0].translation_text);
          setDisabled(false);
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

  return (
    <>
      {" "}
      <div>
        <SidebarProvider>
          <AppSidebar />
          <SidebarTrigger />
          <div className="p-4 w-full h-screen flex flex-col gap-4 justify-between">
            <div>Chat Page</div>
            <UserInput />
          </div>
        </SidebarProvider>
      </div>
    </>
  );
}

function UserInput() {
  return (
    <div className="w-full flex flex-col gap-2 md:flex-row focus-within:ring-2 focus-within:ring-secondary focus-within:ring-offset-2 focus-within:ring-offset-background p-4 rounded-md border border-input">
      <Textarea
        placeholder="Type your text here..."
        className="w-full max-h-40 min-h-10 border-0 resize-none focus-visible:ring-0 focus-visible:outline-none focus-visible:shadow-none focus-visible:border-0"
      />
      <div className="flex justify-end flex-col">
        <Button>
          <Send />
        </Button>
      </div>
    </div>
  );
}
export default Chat;
