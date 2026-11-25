import { cn } from "@/lib/utils";

export function StatusPill({
  running,
  className,
}: {
  running: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold",
        running
          ? "bg-primary text-primary-foreground"
          : "bg-secondary/25 text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          running ? "bg-background" : "bg-accent",
        )}
      />
      {running ? "Serwer aktywny" : "Serwer zatrzymany"}
    </span>
  );
}
