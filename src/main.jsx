import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.jsx";
import { readTheme } from "./app/theme.js";
import "./styles/index.css";

document.documentElement.dataset.theme = readTheme();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
