import { cn } from "@/lib/utils";

export function Brand({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src="/bantrol-app-logo.png"
        alt="Logo Bantrol"
        className="size-11 shrink-0 rounded-2xl"
      />
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-xl font-bold leading-tight tracking-tight">
            Bantrol
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Pilot Twojego komputera
          </p>
        </div>
      )}
    </div>
  );
}
