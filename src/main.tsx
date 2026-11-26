import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { PhoneControlView } from "@/views/phone-control";
import { isTauri } from "@/lib/tauri";
import "./index.css";

// Bantrol is a plain app window, never a browser: no inspection menu and no
// developer tools shortcuts.
document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const devtools =
    key === "f12" ||
    (event.ctrlKey &&
      event.shiftKey &&
      (key === "i" || key === "j" || key === "c")) ||
    (event.ctrlKey && key === "u");
  if (devtools) {
    event.preventDefault();
    event.stopPropagation();
  }
});

/**
 * Every window loads the same bundle. The label decides whether we render the
 * dashboard or a phone-control window, so a control window survives reloads.
 */
function Root() {
  let label: string | undefined;
  if (isTauri()) {
    try {
      label = getCurrentWindow().label;
    } catch {
      label = undefined;
    }
  }
  if (label && label.startsWith("phone-")) {
    return <PhoneControlView label={label} />;
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
