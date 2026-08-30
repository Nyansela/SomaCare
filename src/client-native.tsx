import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";

// Register Capacitor plugins early so they are available throughout the app.
// These are tree-shaken out of the web build by the native vite config.
import "@capacitor/browser";
import "@capacitor/app";
import "@capacitor/local-notifications";

const router = getRouter();

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
