import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  if (mode === "android") {
    const apiUrl = env.VITE_API_BASE_URL?.trim();
    if (!apiUrl) {
      throw new Error("Set VITE_API_BASE_URL in frontend/.env.android before building the Android app.");
    }

    let parsedApiUrl;
    try {
      parsedApiUrl = new URL(apiUrl);
    } catch {
      throw new Error("VITE_API_BASE_URL must be a valid HTTPS URL ending in /api.");
    }

    if (parsedApiUrl.protocol !== "https:" || !parsedApiUrl.pathname.replace(/\/$/, "").endsWith("/api")) {
      throw new Error("VITE_API_BASE_URL must use HTTPS and end in /api.");
    }
  }

  return {
    plugins: [react()],
  };
});
