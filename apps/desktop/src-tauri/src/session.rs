// Where the login comes from. NCM Lite's own QR login is kept in login.json in the app data dir. Until the
// user signs in or out here, the official macOS client's login is reused by reading its cookie jar, on every
// request, so signing in again there takes effect without a restart.
// The cookie stays in this process and only ever travels to music.163.com.
use std::path::PathBuf;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

pub struct Session {
    pub music_u: String,
    pub csrf: String,
}

struct Cookie {
    domain: String,
    name: String,
    value: String,
}

fn u32_at(buf: &[u8], at: usize, big_endian: bool) -> Option<usize> {
    let bytes: [u8; 4] = buf.get(at..at + 4)?.try_into().ok()?;
    Some(if big_endian { u32::from_be_bytes(bytes) } else { u32::from_le_bytes(bytes) } as usize)
}

fn cstr_at(buf: &[u8], at: usize) -> Option<String> {
    let rest = buf.get(at..)?;
    let end = rest.iter().position(|&b| b == 0)?;
    Some(String::from_utf8_lossy(&rest[..end]).into_owned())
}

// Apple binarycookies: big-endian page table, little-endian cookie records.
fn parse_binary_cookies(buf: &[u8]) -> Option<Vec<Cookie>> {
    if buf.get(..4)? != b"cook" {
        return None;
    }
    let pages = u32_at(buf, 4, true)?;
    let mut offset = 8 + pages * 4;
    let mut cookies = Vec::new();
    for p in 0..pages {
        let size = u32_at(buf, 8 + p * 4, true)?;
        let page = buf.get(offset..offset + size)?;
        offset += size;
        for i in 0..u32_at(page, 4, false)? {
            let rec = page.get(u32_at(page, 8 + i * 4, false)?..)?;
            cookies.push(Cookie {
                domain: cstr_at(rec, u32_at(rec, 16, false)?)?,
                name: cstr_at(rec, u32_at(rec, 20, false)?)?,
                value: cstr_at(rec, u32_at(rec, 28, false)?)?,
            });
        }
    }
    Some(cookies)
}

pub fn read_official() -> Result<Session, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME is not set")?;
    let jar = format!("{home}/Library/HTTPStorages/com.netease.163music.binarycookies");
    let buf = std::fs::read(&jar).map_err(|e| format!("Cannot read {jar}: {e}"))?;
    let cookies = parse_binary_cookies(&buf).ok_or("Not a binarycookies file")?;
    let get = |name: &str| {
        cookies
            .iter()
            .find(|c| c.domain.ends_with("music.163.com") && c.name == name)
            .map(|c| c.value.clone())
            .unwrap_or_default()
    };
    let music_u = get("MUSIC_U");
    if music_u.is_empty() {
        return Err("No login found. Sign in once in the official NetEase Music app.".into());
    }
    Ok(Session { music_u, csrf: get("__csrf") })
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Login {
    Own { music_u: String, csrf: String },
    Official,
    SignedOut,
}

static FILE: OnceLock<PathBuf> = OnceLock::new();

pub fn init(data_dir: PathBuf) {
    let _ = FILE.set(data_dir.join("login.json"));
}

// A missing or unreadable file is the state before NCM Lite had a login of its own.
fn stored() -> Login {
    FILE.get()
        .and_then(|f| std::fs::read(f).ok())
        .and_then(|buf| serde_json::from_slice(&buf).ok())
        .unwrap_or(Login::Official)
}

pub fn store(login: &Login) -> Result<(), String> {
    let file = FILE.get().ok_or("The app data dir is not known yet")?;
    if let Some(dir) = file.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(file, serde_json::to_vec(login).unwrap_or_default()).map_err(|e| e.to_string())
}

// None is signed out: requests go out anonymously.
pub fn current() -> Option<Session> {
    match stored() {
        Login::Own { music_u, csrf } => Some(Session { music_u, csrf }),
        Login::Official => read_official().ok(),
        Login::SignedOut => None,
    }
}

pub fn is_own() -> bool {
    matches!(stored(), Login::Own { .. })
}
