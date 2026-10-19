import "@ncm-lite/ui/globals.css";
import "./styles.css";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import { hydrate } from "./cache";
import { router } from "./router";

// The cache is read before the first render, so cached pages never flash a skeleton.
hydrate().then(() => createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />));
