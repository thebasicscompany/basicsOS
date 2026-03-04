import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OverlayApp } from "../../overlay/OverlayApp";
import "@/index.css";
import "../../overlay/overlay.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <OverlayApp />
    </StrictMode>
  );
}
