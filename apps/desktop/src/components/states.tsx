import { useEffect, useState } from "react";

// Loads once per mount. Remount with a key to load something else.
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    load().then(setData, (e) => setError(e.message));
  }, []);
  return { data, error };
}

export const Loading = () => <p className="state muted">加载中</p>;

export const Notice = ({ message }: { message: string }) => <p className="state notice">{message}</p>;

export const Fatal = ({ message }: { message: string }) => (
  <div className="fatal">
    <h1>没能连上网易云</h1>
    <p className="notice">{message}</p>
    <p className="muted">先在官方客户端里登录一次，再重启 NCM Lite。</p>
  </div>
);
