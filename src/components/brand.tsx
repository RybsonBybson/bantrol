import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/bantrol-logo.svg"
      alt="Logo Bantrol"
      className={cn("size-11 shrink-0", className)}
    />
  );
}

export function Brand({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark />
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
