import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
