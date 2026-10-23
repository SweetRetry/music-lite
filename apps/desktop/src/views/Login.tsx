// Signed out of every service. NetEase Music: a QR code to scan in its phone app, or, on a Mac with the official
// client signed in, that login borrowed. QQ Music has no sign-in of its own: it uses the one of its Mac client,
// so a signed-in QQ Music takes the screen before this shows.
import { Button } from "@music-lite/ui/components/ui/button";
import { Skeleton } from "@music-lite/ui/components/ui/skeleton";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { renderSVG } from "uqr";
import { eapi } from "../eapi";
import { library } from "../library";

type Qr =
  | { status: "loading" }
  | { status: "waiting" | "scanned" | "expired"; svg: string }
  | { status: "error"; message: string };

const POLL_MS = 2000;
const HINTS = {
  waiting: "打开网易云音乐 App，扫一扫登录",
  scanned: "已扫码，请在手机上确认登录",
  expired: "二维码已过期",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function LoginView() {
  return (
    <div className="flex h-full flex-col bg-background">
      {/* A drag strip as tall as the shell's title bar, and as much again below so the card sits centred. */}
      <div data-tauri-drag-region className="h-13 shrink-0" />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-13">
        <NcmLogin />
      </div>
    </div>
  );
}

function NcmLogin() {
  const [qr, setQr] = useState<Qr>({ status: "loading" });
  // Bumped to fetch a fresh code.
  const [round, setRound] = useState(0);
  const [official, setOfficial] = useState(false);

  useEffect(() => {
    invoke<boolean>("login_official_available").then(setOfficial, () => {});
  }, []);

  useEffect(() => {
    let live = true;
    setQr({ status: "loading" });
    (async () => {
      const { unikey } = await eapi<{ unikey: string }>("/api/login/qrcode/unikey", { type: 3 });
      const svg = renderSVG(`https://music.163.com/login?codekey=${unikey}`);
      if (live) setQr({ status: "waiting", svg });
      while (live) {
        await sleep(POLL_MS);
        if (!live) return;
        const code = await invoke<number>("login_qr_poll", { key: unikey });
        if (!live) return;
        if (code === 800) return setQr({ status: "expired", svg });
        if (code === 802) setQr({ status: "scanned", svg });
        if (code === 803) return library.load();
      }
    })().catch((e) => live && setQr({ status: "error", message: String(e?.message ?? e) }));
    return () => {
      live = false;
    };
  }, [round]);

  const useOfficial = () =>
    invoke("login_official").then(
      () => library.load(),
      (e) => setQr({ status: "error", message: String(e) }),
    );

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">登录 Music Lite</h1>
      {/* The code stays dark on white in both themes, the way phone scanners expect it. */}
      <div className="relative size-48 overflow-hidden rounded-xl border border-border bg-white p-3">
        {qr.status === "loading" && <Skeleton className="size-full" />}
        {"svg" in qr && (
          <div
            className={`size-full transition-opacity duration-200 ease-out animate-in fade-in [&_svg]:size-full ${qr.status === "waiting" ? "" : "opacity-15"}`}
            dangerouslySetInnerHTML={{ __html: qr.svg }}
          />
        )}
        {(qr.status === "expired" || qr.status === "error") && (
          <div className="absolute inset-0 grid place-items-center animate-in fade-in duration-200">
            <Button size="sm" onClick={() => setRound((r) => r + 1)}>
              刷新二维码
            </Button>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {qr.status === "loading" ? "正在生成二维码" : qr.status === "error" ? `出错了。${qr.message}` : HINTS[qr.status]}
      </p>
      {official && (
        <Button variant="ghost" size="sm" onClick={useOfficial}>
          使用官方客户端的登录
        </Button>
      )}
    </>
  );
}
