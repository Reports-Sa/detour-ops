import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DetourOps } from "../app/detour-ops";
import "../app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("DetourOps root element was not found.");
}

createRoot(root).render(
  <StrictMode>
    <DetourOps />
  </StrictMode>,
);
