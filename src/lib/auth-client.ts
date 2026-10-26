import { createAuthClient } from "better-auth/react";

const configuredBackendUrl = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000/api";
const backendUrl = new URL(configuredBackendUrl, window.location.origin);
const loopbackHosts = new Set(["localhost", "127.0.0.1"]);

if (
  loopbackHosts.has(window.location.hostname) &&
  loopbackHosts.has(backendUrl.hostname)
) {
  backendUrl.hostname = window.location.hostname;
}

export const apiBaseUrl = backendUrl.toString().replace(/\/$/, "");
const authBaseUrl = apiBaseUrl.replace(/\/api\/?$/, "");

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
});

