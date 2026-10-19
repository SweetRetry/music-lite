// The official UI calls fetch("/api/...") and its native layer turns that into an encrypted
// /eapi/ request. Here the native layer is src-tauri/src/eapi.rs, so the login cookie never
// enters the webview.
import { invoke } from "@tauri-apps/api/core";

export const eapi = <T = any>(path: `/api/${string}`, body: Record<string, unknown> = {}) =>
  invoke<T>("eapi", { path, body }).catch((e) => {
    throw new Error(String(e));
  });
