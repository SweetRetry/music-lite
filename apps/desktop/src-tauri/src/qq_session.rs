// QQ Music has no login of its own in NCM Lite. It borrows the one the official macOS client keeps: an
// NSKeyedArchiver archive of a UserInfo under AutoLoginUserInfo in the client's preferences. Read on every
// request, so signing in again there takes effect without a restart.
// The ticket stays in this process and only ever travels to qq.com.
use std::io::Cursor;

use plist::{Dictionary, Value};

pub struct Session {
    pub uin: String,
    pub authst: String,
    pub login_type: i64,
}

const PREFS: &str = "Library/Containers/com.tencent.QQMusicMac/Data/Library/Preferences/com.tencent.QQMusicMac.plist";

// Archived objects point at each other by index. Follows one pointer, and leaves a plain value alone.
fn deref<'a>(objects: &'a [Value], v: &'a Value) -> Option<&'a Value> {
    match v {
        Value::Uid(uid) => objects.get(uid.get() as usize),
        other => Some(other),
    }
}

fn parse_login(archive: &[u8]) -> Option<Session> {
    let archive = Value::from_reader(Cursor::new(archive)).ok()?;
    let archive = archive.as_dictionary()?;
    let objects = archive.get("$objects")?.as_array()?;
    let root = deref(objects, archive.get("$top")?.as_dictionary()?.get("root")?)?.as_dictionary()?;
    let users = deref(objects, root.get("userArray")?)?.as_dictionary()?.get("NS.objects")?.as_array()?;
    let user: &Dictionary = deref(objects, users.first()?)?.as_dictionary()?;
    let field = |key: &str| deref(objects, user.get(key)?);
    let authst = field("strAuthst")?.as_string()?.to_owned();
    let uin = field("strUserAccount")
        .and_then(Value::as_string)
        .map(str::to_owned)
        .or_else(|| field("nUserId")?.as_signed_integer().map(|n| n.to_string()))?;
    if authst.is_empty() || uin.is_empty() {
        return None;
    }
    Some(Session { uin, authst, login_type: field("loginType").and_then(Value::as_signed_integer).unwrap_or(0) })
}

// Ok(None) is the client being signed out, or never run. Err is a login that exists but cannot be read.
pub fn read() -> Result<Option<Session>, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME is not set")?;
    let path = format!("{home}/{PREFS}");
    let prefs = match Value::from_file(&path) {
        Ok(v) => v,
        Err(e) => {
            return match std::fs::metadata(&path) {
                Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
                Err(err) if err.kind() == std::io::ErrorKind::PermissionDenied => Err(DENIED.into()),
                _ => Err(format!("Cannot read {path}: {e}")),
            };
        }
    };
    let archive = prefs.as_dictionary().and_then(|d| d.get("AutoLoginUserInfo")).and_then(Value::as_data);
    Ok(archive.and_then(parse_login))
}

const DENIED: &str = "没有权限读取 QQ 音乐的登录。在系统设置的隐私与安全性里，给 NCM Lite 开启完全磁盘访问权限";

#[cfg(test)]
mod tests {
    use super::*;
    use plist::Uid;

    fn dict(entries: Vec<(&str, Value)>) -> Value {
        Value::Dictionary(entries.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
    }

    // The shape QQ Music writes: $top.root -> object -> userArray -> NS.objects -> UserInfo, each a pointer.
    fn archive(user: Vec<(&str, Value)>) -> Vec<u8> {
        let uid = |n: u64| Value::Uid(Uid::new(n));
        let objects = vec![
            Value::String("$null".into()),
            dict(vec![("userArray", uid(2))]),
            dict(vec![("NS.objects", Value::Array(vec![uid(3)]))]),
            Value::Dictionary(user.into_iter().map(|(k, v)| (k.to_string(), v)).collect()),
        ];
        let root = dict(vec![("$top", dict(vec![("root", uid(1))])), ("$objects", Value::Array(objects))]);
        let mut out = Vec::new();
        plist::to_writer_binary(&mut out, &root).unwrap();
        out
    }

    #[test]
    fn reads_the_ticket_from_an_archive() {
        let uid = |n: u64| Value::Uid(Uid::new(n));
        // Strings are archived as separate objects the user dictionary points at.
        let objects = vec![
            Value::String("$null".into()),
            dict(vec![("userArray", uid(2))]),
            dict(vec![("NS.objects", Value::Array(vec![uid(3)]))]),
            dict(vec![("strAuthst", uid(4)), ("strUserAccount", uid(5)), ("loginType", Value::Integer(3.into()))]),
            Value::String("ticket".into()),
            Value::String("10001".into()),
        ];
        let root = dict(vec![("$top", dict(vec![("root", uid(1))])), ("$objects", Value::Array(objects))]);
        let mut bytes = Vec::new();
        plist::to_writer_binary(&mut bytes, &root).unwrap();
        let s = parse_login(&bytes).unwrap();
        assert_eq!((s.uin.as_str(), s.authst.as_str(), s.login_type), ("10001", "ticket", 3));
    }

    #[test]
    fn falls_back_to_the_numeric_user_id() {
        let bytes = archive(vec![("strAuthst", Value::String("t".into())), ("nUserId", Value::Integer(42.into()))]);
        assert_eq!(parse_login(&bytes).unwrap().uin, "42");
    }

    #[test]
    fn an_empty_ticket_is_signed_out() {
        let bytes = archive(vec![("strAuthst", Value::String(String::new())), ("strUserAccount", Value::String("1".into()))]);
        assert!(parse_login(&bytes).is_none());
        assert!(parse_login(b"not a plist").is_none());
    }
}
