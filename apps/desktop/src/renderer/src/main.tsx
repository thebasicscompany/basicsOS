import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OverlayApp } from "./OverlayApp";
import "./main.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <OverlayApp />
    </StrictMode>,
  );
}
