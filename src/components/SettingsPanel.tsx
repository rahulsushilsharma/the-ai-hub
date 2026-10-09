import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

export type Field =
  | { key: string; type: "slider"; label: string; min: number; max: number; step: number; hint?: string }
  | { key: string; type: "select"; label: string; options: { value: string; label: string }[]; hint?: string }
  | { key: string; type: "toggle"; label: string; hint?: string }
  | { key: string; type: "text"; label: string; placeholder?: string; hint?: string };

type Values = Record<string, string | number | boolean>;

export default function SettingsPanel({
  title = "Settings",
  fields,
  values,
  onChange,
  onReset,
  disabled,
}: {
  title?: string;
  fields: Field[];
  values: object;
  onChange: (patch: Values) => void;
  onReset?: () => void;
  disabled?: boolean;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-xl border bg-card p-5 md:p-6 space-y-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {onReset && (
          <Button variant="ghost" size="sm" onClick={onReset} disabled={disabled}>
            Reset
          </Button>
        )}
      </div>
      {fields.map((f) => {
        const id = `setting-${f.key}`;
        const v = (values as Values)[f.key];
        return (
          <div key={f.key} className="space-y-1.5">
            {f.type === "toggle" ? (
              <label htmlFor={id} className="flex items-center justify-between text-sm font-medium">
                {f.label}
                <input
                  id={id}
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={Boolean(v)}
                  disabled={disabled}
                  onChange={(e) => onChange({ [f.key]: e.target.checked })}
                />
              </label>
            ) : (
              <label htmlFor={id} className="flex justify-between text-sm font-medium leading-none">
                {f.label}
                {f.type === "slider" && (
                  <span className="font-mono text-muted-foreground tabular-nums">{Number(v)}</span>
                )}
              </label>
            )}
            {f.type === "slider" && (
              <Slider
                id={id}
                aria-label={f.label}
                min={f.min}
                max={f.max}
                step={f.step}
                value={[Number(v)]}
                disabled={disabled}
                onValueChange={(x) => onChange({ [f.key]: x[0] })}
              />
            )}
            {f.type === "select" && (
              <Select value={String(v)} disabled={disabled} onValueChange={(x) => onChange({ [f.key]: x })}>
                <SelectTrigger id={id} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {f.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {f.type === "text" && (
              <Textarea
                id={id}
                rows={3}
                value={String(v)}
                placeholder={f.placeholder}
                disabled={disabled}
                className="border-border/50 bg-muted/30 resize-none"
                onChange={(e) => onChange({ [f.key]: e.target.value })}
              />
            )}
            {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
          </div>
        );
      })}
    </section>
  );
}
