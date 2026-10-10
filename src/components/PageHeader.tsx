import type { LucideIcon } from "lucide-react";

export function PageGlow() {
  return (
    <div className="absolute inset-0 -z-10 pointer-events-none">
      <div className="absolute top-1/4 left-1/2 size-[300px] md:size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/15 blur-[90px] md:blur-3xl" />
    </div>
  );
}

export default function PageHeader({
  icon: Icon,
  title,
  blurb,
  tags,
}: {
  icon: LucideIcon;
  title: string;
  blurb?: string;
  tags?: string[];
}) {
  return (
    <header className="mb-10 text-center">
      <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 ring-1 ring-primary/20">
        <Icon className="size-6 text-primary" />
      </div>
      <h1 className="mb-3 text-4xl font-semibold tracking-tighter md:text-5xl">
        {title}
      </h1>
      {blurb && (
        <p className="mx-auto max-w-md text-sm text-muted-foreground md:text-base">
          {blurb}
        </p>
      )}
      {tags?.length ? (
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          {tags.join(" · ")}
        </p>
      ) : null}
    </header>
  );
}
