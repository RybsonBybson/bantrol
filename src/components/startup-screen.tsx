import { motion } from "framer-motion";

import type { UpdatePhase } from "@/hooks/use-updater";

function copy(phase: UpdatePhase, version: string | null) {
  switch (phase) {
    case "checking":
      return {
        title: "Sprawdzamy aktualizacje",
        text: "Upewniamy się, że masz najnowszą wersję Bantrola.",
      };
    case "downloading":
      return {
        title: "Nowa wersja w drodze",
        text: version
          ? `Pobieramy Bantrol ${version}. Możesz spokojnie poczekać.`
          : "Pobieramy nową wersję Bantrola. Możesz spokojnie poczekać.",
      };
    case "installing":
      return {
        title: "Prawie gotowe",
        text: "Instalujemy aktualizację i zaraz uruchomimy Bantrola od nowa.",
      };
    default:
      return {
        title: "Uruchamiamy Bantrola",
        text: "Przygotowujemy Twoje połączenie z telefonem.",
      };
  }
}

export function StartupScreen({
  phase,
  progress,
  version,
}: {
  phase: UpdatePhase;
  progress: number;
  version: string | null;
}) {
  const { title, text } = copy(phase, version);
  const showProgress = phase === "downloading" || phase === "installing";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-full flex-col items-center justify-center gap-7 bg-background px-6 text-center"
    >
      <div className="relative flex size-28 items-center justify-center">
        <motion.span
          className="absolute inset-0 rounded-[2.25rem] bg-secondary/25"
          animate={{ scale: [1, 1.08, 1], opacity: [0.7, 0.35, 0.7] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.img
          src="/bantrol-logo.svg"
          alt="Logo Bantrol"
          className="relative size-20 rounded-[1.6rem]"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
        />
      </div>

      <div className="flex flex-col items-center gap-2">
        <motion.h1
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="text-3xl font-bold tracking-tight"
        >
          {title}
        </motion.h1>
        <motion.p
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.16 }}
          className="max-w-sm text-sm leading-relaxed text-muted-foreground"
        >
          {text}
        </motion.p>
      </div>

      {showProgress ? (
        <div className="w-full max-w-xs">
          <div className="h-2 overflow-hidden rounded-full bg-secondary/25">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(progress, 4)}%` }}
              transition={{ ease: "easeOut", duration: 0.35 }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold tabular-nums text-muted-foreground">
            {progress}%
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              className="size-2 rounded-full bg-accent"
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
              transition={{
                duration: 1.1,
                repeat: Infinity,
                delay: index * 0.16,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
