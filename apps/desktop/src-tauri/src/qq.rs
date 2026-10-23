// The native layer for QQ Music, the counterpart of eapi.rs. The web layer names a module, a method and its
// param, and this signs the call and sends it with the client's login, so the ticket never enters the webview.
use std::sync::LazyLock;

use serde::Deserialize;
use serde_json::{json, Value};

use crate::{qq_session, qq_sign};

const HOST: &str = "https://u6.y.qq.com/cgi-bin/musics.fcg";

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .expect("HTTP client")
});

// Whose call the server believes it is answering. Searches only return results to the web player, and a
// like or a playlist edit is only taken from the desktop client.
#[derive(Deserialize, Default, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum Comm {
    #[default]
    Client,
    Web,
}

impl Comm {
    fn json(self) -> Value {
        match self {
            Comm::Client => json!({ "ct": 11, "cv": 13020508, "format": "json", "inCharset": "utf-8", "outCharset": "utf-8" }),
            Comm::Web => json!({
                "ct": 24, "cv": 4747474, "format": "json", "inCharset": "utf-8", "outCharset": "utf-8",
                "notice": 0, "platform": "yqq.json", "needNewCode": 1
            }),
        }
    }
}

// Ok(Some(uin)) when the QQ Music client on this Mac is signed in.
#[tauri::command]
pub fn qq_login() -> Result<Option<String>, String> {
    Ok(qq_session::read()?.map(|s| s.uin))
}

// Returns the data of the one call made, and an error for any code but 0.
#[tauri::command]
pub async fn qqapi(module: String, method: String, param: Value, comm: Option<Comm>) -> Result<Value, String> {
    call(&module, &method, param, comm.unwrap_or_default()).await
}

pub async fn call(module: &str, method: &str, param: Value, comm: Comm) -> Result<Value, String> {
    let name = format!("{module}.{method}");
    let session = qq_session::read()?.ok_or("QQ 音乐还没登录")?;
    let mut head = comm.json();
    head["uin"] = session.uin.clone().into();
    head["qq"] = session.uin.clone().into();
    head["authst"] = session.authst.clone().into();
    head["tmeLoginType"] = session.login_type.to_string().into();
    let payload = json!({ "comm": head, "req_0": { "module": module, "method": method, "param": param } }).to_string();

    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let cookie = format!(
        "uin={0}; qqmusic_uin={0}; qqmusic_key={1}; qm_keyst={1}; tmeLoginType={2}",
        session.uin, session.authst, session.login_type
    );
    let res = CLIENT
        .post(format!("{HOST}?_={}&encoding=ag-1&sign={}", now.as_millis(), qq_sign::zzc_sign(&payload)))
        .header("Content-Type", "text/plain;charset=UTF-8")
        .header("Referer", "https://y.qq.com/")
        .header("Cookie", cookie)
        .body(qq_sign::ag1_seal(&payload))
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| {
            eprintln!("{name} failed: {e}");
            "暂时无法连接 QQ 音乐。".to_string()
        })?;
    let raw = res.bytes().await.map_err(|e| {
        eprintln!("{name} failed: {e}");
        "暂时无法连接 QQ 音乐。".to_string()
    })?;
    // A few responses carry bytes that are not UTF-8 after unsealing. The code and data are ASCII-framed, so lossy is safe.
    let text = String::from_utf8_lossy(&qq_sign::ag1_open_response(&raw)).into_owned();
    let json: Value = serde_json::from_str(&text).map_err(|e| {
        eprintln!("{name} returned invalid JSON: {e}");
        "QQ 音乐暂时无法返回数据。".to_string()
    })?;

    if json["code"].as_i64().unwrap_or(-1) != 0 {
        return Err(format!("{name} returned {}", json["code"]));
    }
    let reply = &json["req_0"];
    match reply["code"].as_i64() {
        Some(0) => Ok(reply["data"].clone()),
        code => Err(format!("{name} returned {}", code.unwrap_or(-1))),
    }
}
