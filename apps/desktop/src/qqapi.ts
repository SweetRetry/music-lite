// Every QQ Music call goes through the native layer, src-tauri/src/qq.rs, which signs it and adds the login
// of the QQ Music client, so the ticket never enters the webview. comm "web" is for searches only.
import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

export const QQ_ACCESS_MESSAGE = "需要授权读取 QQ 音乐登录。";
export const useQqAccess = create<{ denied: boolean }>(() => ({ denied: false }));

// One system picker for concurrent requests. Cancelling suppresses automatic prompts for this session.
let asked = false;
let accessRequest: Promise<boolean> | null = null;
let accessVersion = 0;

export function requestQqAccess(): Promise<boolean> {
  asked = true;
  if (!accessRequest) {
    accessRequest = invoke<boolean>("qq_request_access")
      .then((granted) => {
        if (granted) accessVersion++;
        useQqAccess.setState({ denied: !granted });
        return granted;
      })
      .catch((e) => { throw new Error(String(e)); })
      .finally(() => { accessRequest = null; });
  }
  return accessRequest;
}

export async function qqInvoke<T>(command: "qq_login" | "qqapi", args?: Record<string, unknown>): Promise<T> {
  const version = accessVersion;
  try {
    const result = await invoke<T>(command, args);
    useQqAccess.setState({ denied: false });
    return result;
  } catch (error) {
    if (error !== "QQ_PERMISSION_DENIED") throw new Error(String(error));
    // An old failure can arrive after another request has obtained access.
    if (version !== accessVersion) return qqInvoke<T>(command, args);
    useQqAccess.setState({ denied: true });
    if ((!asked || accessRequest) && await requestQqAccess()) return qqInvoke<T>(command, args);
    throw new Error(QQ_ACCESS_MESSAGE);
  }
}

export const qqapi = <T = any>(module: string, method: string, param: Record<string, unknown> = {}, comm?: "web") =>
  qqInvoke<T>("qqapi", { module, method, param, comm });
