// The official UI calls fetch("/api/...") and the native CEF layer rewrites it into an
// encrypted /eapi/ request. This module is that native layer.
use std::sync::LazyLock;

use aes::Aes128;
use ecb::cipher::{block_padding::Pkcs7, BlockModeDecrypt, BlockModeEncrypt, KeyInit};
use md5::{Digest, Md5};
use serde_json::{json, Map, Value};

use crate::session;

const KEY: &[u8; 16] = b"e82ckenh8dichen8";
const HOST: &str = "https://interface.music.163.com";
const APPVER: &str = "3.1.13";

static DEVICE_ID: LazyLock<String> = LazyLock::new(|| hex::encode_upper(rand::random::<[u8; 16]>()));
static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .user_agent(format!(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) NeteaseMusicDesktop/{APPVER}"
        ))
        .build()
        .expect("HTTP client")
});

fn encrypt(data: &[u8]) -> Vec<u8> {
    ecb::Encryptor::<Aes128>::new(KEY.into()).encrypt_padded_vec::<Pkcs7>(data)
}

fn decrypt(data: &[u8]) -> Result<Vec<u8>, String> {
    ecb::Decryptor::<Aes128>::new(KEY.into())
        .decrypt_padded_vec::<Pkcs7>(data)
        .map_err(|_| "Cannot decrypt the response".to_string())
}

fn encrypt_params(path: &str, text: &str) -> String {
    let digest = hex::encode(Md5::digest(format!("nobody{path}use{text}md5forencrypt")));
    hex::encode_upper(encrypt(format!("{path}-36cd479b6b5-{text}-36cd479b6b5-{digest}").as_bytes()))
}

#[tauri::command]
pub async fn eapi(path: String, mut body: Map<String, Value>) -> Result<Value, String> {
    let rest = path.strip_prefix("/api/").ok_or_else(|| format!("{path} is not an /api/ path"))?;
    let session = session::read_official()?;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let header = json!({
        "os": "osx",
        "appver": APPVER,
        "osver": "15.0",
        "deviceId": *DEVICE_ID,
        "requestId": format!("{}_{}", now.as_millis(), rand::random_range(0..1000)),
        "MUSIC_U": session.music_u,
        "__csrf": session.csrf,
    });
    let cookie = header
        .as_object()
        .into_iter()
        .flatten()
        .map(|(k, v)| format!("{k}={}", urlencoding::encode(v.as_str().unwrap_or_default())))
        .collect::<Vec<_>>()
        .join("; ");
    body.insert("header".into(), Value::String(header.to_string()));
    body.insert("e_r".into(), Value::Bool(false));
    let params = encrypt_params(&path, &Value::Object(body).to_string());

    let raw = CLIENT
        .post(format!("{HOST}/eapi/{rest}"))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .header("Cookie", cookie)
        .body(format!("params={params}"))
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("{path} failed: {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("{path} failed: {e}"))?;
    let plain = if raw.first() == Some(&b'{') { raw.to_vec() } else { decrypt(&raw)? };
    let json: Value = serde_json::from_slice(&plain).map_err(|e| format!("{path} returned invalid JSON: {e}"))?;

    match json["code"].as_i64() {
        Some(200) => Ok(json),
        code => {
            let message = json["message"].as_str().or(json["msg"].as_str()).unwrap_or("unknown");
            Err(format!("{path} returned {}: {message}", code.unwrap_or(-1)))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Expected values come from the original node:crypto implementation.
    #[test]
    fn params_match_the_official_client() {
        assert_eq!(
            encrypt_params("/api/song/lyric/v1", r#"{"id":1,"e_r":false}"#),
            "04AE33D34A93FE3EC22DA8FA305D290AB337D0FE5F36D211DE0D338CC6AA89D0313B05594526B4A083C65FF477BB4EE17DFCAC40D6F8E65B64615B0D38E437885E1732220091FD0E9A0CDAE8B8B1B29FB13F5A22BF01E3E5908904EA57F221F06AA3B102FBE7296AB0DB9EA5C46AD12B"
        );
    }

    #[test]
    fn decrypts_an_encrypted_response() {
        let raw = hex::decode("51b05e35c69b2f9ff4967735ded68881").unwrap();
        assert_eq!(decrypt(&raw).unwrap(), br#"{"code":200}"#);
    }
}
