import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CHAT_MODELS } from "@/consts/consts";
import { DEFAULT_CHAT_SETTINGS, useAppStore, useChatSettings } from "@/services/uiStore";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import SettingsPanel, { type Field } from "./SettingsPanel";

const FIELDS: Field[] = [
  { key: "system_prompt", type: "text", label: "System prompt", placeholder: "e.g. You are a concise assistant." },
  { key: "do_sample", type: "toggle", label: "Sampling", hint: "Off = always pick the most likely token (deterministic)." },
  { key: "temperature", type: "slider", label: "Temperature", min: 0, max: 2, step: 0.1, hint: "Higher = more creative. Needs sampling on." },
  { key: "top_p", type: "slider", label: "Top-p", min: 0.1, max: 1, step: 0.05 },
  { key: "repetition_penalty", type: "slider", label: "Repetition penalty", min: 1, max: 2, step: 0.05 },
  { key: "max_new_tokens", type: "slider", label: "Max new tokens", min: 64, max: 2048, step: 64 },
];

function ModelChatSettings() {
  const appState = useAppStore((state) => state.appState);
  const setAppState = useAppStore((state) => state.setAppState);
  const settings = useChatSettings((state) => state.settings);
  const model = useChatSettings((state) => state.model);
  const setModel = useChatSettings((state) => state.setModel);
  const setChatSettings = useChatSettings((state) => state.setChatSettings);

  return (
    <>
      <Dialog
        open={appState.settingsOpen}
        onOpenChange={(value) => setAppState({ settingsOpen: value })}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium text-center">
              Chat settings
            </DialogTitle>
            <DialogDescription>
              Pick a model and how creative its replies should be.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="mb-4">
              <h3 className="text-sm font-medium leading-none mb-1.5 ml-0.5">
                Model
              </h3>
              <Select
                onValueChange={(value) =>
                  setModel(
                    CHAT_MODELS.find((model) => model.value === value) || model
                  )
                }
                value={model.value}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent>
                  {CHAT_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SettingsPanel
              title="Generation"
              fields={FIELDS}
              values={settings}
              onChange={(p) => setChatSettings({ ...settings, ...p })}
              onReset={() => setChatSettings(DEFAULT_CHAT_SETTINGS)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="default"
              onClick={() => setAppState({ settingsOpen: false })}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
export default ModelChatSettings;
