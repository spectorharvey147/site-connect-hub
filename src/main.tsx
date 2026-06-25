import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";

import { App } from "@/App";
import { AuthProvider } from "@/context/AuthContext";
import { prepareRuntimeStorage } from "@/services/runtimeBootstrap";
import { themeService } from "@/services/themeService";
import "@/styles/index.css";

prepareRuntimeStorage();
themeService.initialize();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/service-worker.js");
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
