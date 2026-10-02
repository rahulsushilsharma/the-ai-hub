import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CHAT_MODELS } from "@/consts/consts";
import { useAppStore, useChatSettings } from "@/services/uiStore";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";

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
        <DialogContent>
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
            <div className="">
              <h3 className="mb-1.5 flex justify-between text-sm font-medium leading-none">
                Temperature
                <span className="font-mono text-muted-foreground tabular-nums">
                  {settings.temperature.toFixed(1)}
                </span>
              </h3>

              <Slider
                aria-label="Temperature"
                defaultValue={[settings.temperature]}
                max={1}
                step={0.1}
                onValueChange={(value) =>
                  setChatSettings({ ...settings, temperature: value[0] })
                }
              />
            </div>
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
