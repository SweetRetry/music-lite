// Music Lite's own login: a QR code scanned in the NetEase Music phone app. The web layer asks for the code
// through eapi (/api/login/qrcode/unikey) and polls here, because a confirmed scan returns the login cookie,
// which must not reach the webview.
use serde_json::Map;

use crate::eapi::send;
use crate::session::{self, Login};

// Codes: 800 expired, 801 waiting for a scan, 802 scanned and waiting for the confirm, 803 signed in.
#[tauri::command]
pub async fn login_qr_poll(key: String) -> Result<i64, String> {
    let mut body = Map::new();
    body.insert("key".into(), key.into());
    body.insert("type".into(), 3.into());
    let (json, headers) = send("/api/login/qrcode/client/login", body, None).await?;
    let code = json["code"].as_i64().unwrap_or(-1);
    if code == 803 {
        // The cookies come as Set-Cookie headers, and some servers repeat them in a cookie field of the body.
        let mut jar: Vec<String> = headers
            .get_all("set-cookie")
            .iter()
            .filter_map(|v| v.to_str().ok().map(String::from))
            .collect();
        jar.extend(json["cookie"].as_str().map(String::from));
        let get = |name: &str| {
            jar.iter()
                .flat_map(|c| c.split(';'))
                .filter_map(|kv| kv.trim().split_once('='))
                .find(|(k, _)| *k == name)
                .map(|(_, v)| v.to_string())
                .unwrap_or_default()
        };
        let music_u = get("MUSIC_U");
        if music_u.is_empty() {
            return Err("登录成功了，但没拿到登录凭证".into());
        }
        session::store(&Login::Own { music_u, csrf: get("__csrf") })?;
    }
    Ok(code)
}

// Whether the official client on this Mac has a login to borrow.
#[tauri::command]
pub fn login_official_available() -> bool {
    session::read_official().is_ok()
}

#[tauri::command]
pub fn login_official() -> Result<(), String> {
    session::read_official()?;
    session::store(&Login::Official)
}

