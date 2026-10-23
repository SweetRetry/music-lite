// Install the built local release, preserving the bundle ID and the app's saved data.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";

const source = fileURLToPath(new URL("../apps/desktop/src-tauri/target/release/bundle/macos/Music Lite.app", import.meta.url));
const target = "/Applications/Music Lite.app";
const info = JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", `${source}/Contents/Info.plist`], { encoding: "utf8" }));
assert.equal(info.CFBundleName, "Music Lite");
assert.equal(info.CFBundleIdentifier, "com.sweetretry.musiclite");
const executable = `Contents/MacOS/${info.CFBundleExecutable}`;
const running = execFileSync("ps", ["-ax", "-o", "pid=,command="], { encoding: "utf8" })
  .split("\n").map((line) => line.trim().match(/^(\d+)\s+(.+)$/))
  .filter((match) => match?.[2] === `${target}/${executable}`).map((match) => Number(match[1]));
for (const pid of running) process.kill(pid, "SIGTERM");
for (let attempt = 0; attempt < 20; attempt++) {
  const alive = running.some((pid) => { try { process.kill(pid, 0); return true; } catch { return false; } });
  if (!alive) break;
  assert.notEqual(attempt, 19, "Quit Music Lite before installing the update.");
  await setTimeout(100);
}
execFileSync("codesign", ["--force", "--deep", "--sign", "-", source], { stdio: "inherit" });
execFileSync("ditto", [source, target]);
execFileSync("codesign", ["--verify", "--deep", "--strict", target]);
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
assert.equal(digest(`${source}/${executable}`), digest(`${target}/${executable}`));
console.log("Installed Music Lite. Signature and installed binary verified.");
