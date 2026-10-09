import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Item = { cache: string; model: string; urls: string[]; bytes: number };

const fmt = (b: number) =>
  b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`;

// HF urls: huggingface.co/{org}/{repo}/resolve/... -> "org/repo"; else host.
const modelOf = (url: string) => {
  const u = new URL(url);
  const m = u.pathname.match(/^\/([^/]+\/[^/]+)\/resolve\//);
  return m ? m[1] : u.host + u.pathname.split("/").slice(0, 2).join("/");
};

async function scan(): Promise<Item[]> {
  const groups = new Map<string, Item>();
  for (const cache of await caches.keys()) {
    const c = await caches.open(cache);
    for (const req of await c.keys()) {
      const res = await c.match(req);
      if (!res) continue;
      // content-length avoids loading multi-GB bodies; blob() only as fallback
      const len = Number(res.headers.get("content-length"));
      const bytes = len > 0 ? len : (await res.blob()).size;
      const model = modelOf(req.url);
      const key = `${cache}\0${model}`;
      const g = groups.get(key) ?? { cache, model, urls: [], bytes: 0 };
      g.urls.push(req.url);
      g.bytes += bytes;
      groups.set(key, g);
    }
  }
  return [...groups.values()].sort((a, b) => b.bytes - a.bytes);
}

export default function Storage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [quota, setQuota] = useState<StorageEstimate>();

  const refresh = useCallback(async () => {
    try {
      setItems(await scan());
      setQuota(await navigator.storage?.estimate());
    } catch {
      setItems([]); // Cache API unavailable (private mode, insecure context)
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const remove = async (it: Item) => {
    const c = await caches.open(it.cache);
    await Promise.all(it.urls.map((u) => c.delete(u)));
    refresh();
  };
  const removeAll = async () => {
    if (!confirm("Delete all downloaded models? They re-download on next use.")) return;
    await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    refresh();
  };

  const total = items?.reduce((s, i) => s + i.bytes, 0) ?? 0;

  return (
    <div className="flex min-h-dvh flex-col pt-16 md:pt-24">
      <div className="container mx-auto max-w-2xl flex-1 px-4 pb-16">
        <h1 className="mb-2 text-4xl font-semibold tracking-tighter md:text-5xl">
          Model storage
        </h1>
        <p className="mb-8 text-muted-foreground">
          Models are cached in your browser after first download. Delete any you
          no longer need; they re-download when used again.
        </p>
        <p className="mb-4 font-mono text-sm">
          {items ? `${fmt(total)} in ${items.length} model(s)` : "Scanning…"}
          {quota?.usage != null &&
            ` · site total ${fmt(quota.usage)} of ${fmt(quota.quota ?? 0)}`}
        </p>
        <ul className="mb-6 divide-y rounded-lg border">
          {items?.map((it) => (
            <li key={it.cache + it.model} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{it.model}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {fmt(it.bytes)} · {it.urls.length} files · {it.cache}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${it.model}`}
                onClick={() => remove(it)}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </li>
          ))}
          {items?.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">
              No cached models.
            </li>
          )}
        </ul>
        <Button variant="destructive" disabled={!items?.length} onClick={removeAll}>
          Delete all
        </Button>
      </div>
      <Footer />
    </div>
  );
}
