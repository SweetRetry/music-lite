// Every QQ Music call goes through the native layer, src-tauri/src/qq.rs, which signs it and adds the login
// of the QQ Music client, so the ticket never enters the webview. comm "web" is for searches only.
import { invoke } from "@tauri-apps/api/core";

export const qqapi = <T = any>(module: string, method: string, param: Record<string, unknown> = {}, comm?: "web") =>
  invoke<T>("qqapi", { module, method, param, comm }).catch((e) => {
    throw new Error(String(e));
  });
