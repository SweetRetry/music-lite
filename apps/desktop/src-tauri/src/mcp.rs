// An MCP server on 127.0.0.1, so an agent can search songs and tidy playlists in the app that is running.
// This side only speaks the protocol. tools/list and tools/call go to the webview as an "mcp" event, src/mcp.ts
// answers them through the library, and the answer comes back by mcp_reply. What an agent changes shows at once.
//
// No token. Any process on this Mac can already read the logins this app uses, so the guard is against web
// pages: a browser always sends Origin on a cross-site request, and DNS rebinding shows up in Host.
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, LazyLock, Mutex};
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tiny_http::{Header, Method, Request, Response, Server};

pub const PORT: u16 = 38561;
// Opening a playlist of a few thousand songs takes several requests.
const TIMEOUT: Duration = Duration::from_secs(120);
const VERSION: &str = "2025-06-18";

type Reply = Result<Value, String>;

static PENDING: LazyLock<Mutex<HashMap<u64, mpsc::Sender<Reply>>>> = LazyLock::new(Default::default);
static NEXT: AtomicU64 = AtomicU64::new(0);

pub fn serve(app: AppHandle) {
    match Server::http(("127.0.0.1", PORT)) {
        Ok(server) => run(server, move |method, params| forward(&app, method, params)),
        // Another copy of the app holds the port. The app works without it.
        Err(e) => eprintln!("MCP server not started on {PORT}: {e}"),
    }
}

fn run(server: Server, forward: impl Fn(&str, &Value) -> Reply + Send + Sync + 'static) {
    let port = server.server_addr().to_ip().map_or(PORT, |a| a.port());
    let forward = std::sync::Arc::new(forward);
    std::thread::spawn(move || {
        for req in server.incoming_requests() {
            let forward = forward.clone();
            std::thread::spawn(move || handle(req, port, &*forward));
        }
    });
}

fn header<'a>(req: &'a Request, name: &str) -> Option<&'a str> {
    req.headers().iter().find(|h| h.field.as_str().as_str().eq_ignore_ascii_case(name)).map(|h| h.value.as_str())
}

fn handle(mut req: Request, port: u16, forward: &dyn Fn(&str, &Value) -> Reply) {
    let host = header(&req, "Host").unwrap_or_default();
    let local = host == format!("127.0.0.1:{port}") || host == format!("localhost:{port}");
    let (status, body) = if !local || header(&req, "Origin").is_some() {
        (403, None)
    } else if req.url() != "/mcp" {
        (404, None)
    } else if req.method() != &Method::Post {
        // No stream for the server to call the client on, so GET has nothing to open.
        (405, None)
    } else {
        let mut raw = String::new();
        match req.as_reader().read_to_string(&mut raw).ok().and_then(|_| serde_json::from_str::<Value>(&raw).ok()) {
            None => (400, Some(error(Value::Null, -32700, "Parse error"))),
            Some(msg) => match answer(&msg, forward) {
                Some(reply) => (200, Some(reply)),
                // A notification, which gets no reply.
                None => (202, None),
            },
        }
    };
    let res = match body {
        Some(body) => Response::from_string(body.to_string())
            .with_header(Header::from_bytes("Content-Type", "application/json").unwrap()),
        None => Response::from_string(""),
    };
    let _ = req.respond(res.with_status_code(status));
}

fn error(id: Value, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

// The JSON-RPC reply to one message, or None for a notification.
fn answer(msg: &Value, forward: &dyn Fn(&str, &Value) -> Reply) -> Option<Value> {
    let method = msg["method"].as_str()?;
    let id = msg.get("id")?.clone();
    let params = &msg["params"];
    let result = match method {
        "initialize" => json!({
            // Nothing here differs between the versions in use, so the client's own is accepted.
            "protocolVersion": params["protocolVersion"].as_str().unwrap_or(VERSION),
            "capabilities": { "tools": {} },
            "serverInfo": { "name": "ncm-lite", "version": env!("CARGO_PKG_VERSION") },
        }),
        "ping" => json!({}),
        "tools/list" => match forward(method, params) {
            Ok(result) => result,
            Err(e) => return Some(error(id, -32603, &e)),
        },
        // A tool that fails is still an answer, which the agent reads and can act on.
        "tools/call" => forward(method, params)
            .unwrap_or_else(|e| json!({ "content": [{ "type": "text", "text": e }], "isError": true })),
        _ => return Some(error(id, -32601, "Method not found")),
    };
    Some(json!({ "jsonrpc": "2.0", "id": id, "result": result }))
}

fn forward(app: &AppHandle, method: &str, params: &Value) -> Reply {
    let id = NEXT.fetch_add(1, Ordering::Relaxed);
    let (tx, rx) = mpsc::channel();
    PENDING.lock().unwrap().insert(id, tx);
    let reply = app
        .emit("mcp", json!({ "id": id, "method": method, "params": params }))
        .map_err(|e| e.to_string())
        .and_then(|_| rx.recv_timeout(TIMEOUT).map_err(|_| "NCM Lite 没有回应".to_string()))
        .and_then(|r| r);
    PENDING.lock().unwrap().remove(&id);
    reply
}

#[tauri::command]
pub fn mcp_reply(id: u64, result: Option<Value>, error: Option<String>) {
    if let Some(tx) = PENDING.lock().unwrap().remove(&id) {
        let _ = tx.send(error.map_or(Ok(result.unwrap_or(Value::Null)), Err));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpStream;

    // A webview that knows one tool, which fails on "boom".
    fn webview(method: &str, params: &Value) -> Reply {
        match (method, params["name"].as_str()) {
            ("tools/list", _) => Ok(json!({ "tools": [{ "name": "search" }] })),
            ("tools/call", Some("boom")) => Err("没找到".into()),
            ("tools/call", _) => Ok(json!({ "content": [{ "type": "text", "text": "ok" }] })),
            _ => unreachable!(),
        }
    }

    fn post(port: u16, extra: &str, body: &str) -> (u16, String) {
        let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
        write!(
            s,
            "POST /mcp HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n{extra}Content-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
        .unwrap();
        let mut res = String::new();
        s.read_to_string(&mut res).unwrap();
        let status = res[9..12].parse().unwrap();
        (status, res.split("\r\n\r\n").nth(1).unwrap_or_default().to_string())
    }

    #[test]
    fn speaks_mcp_over_http() {
        let server = Server::http("127.0.0.1:0").unwrap();
        let port = server.server_addr().to_ip().unwrap().port();
        run(server, webview);

        let (status, body) = post(port, "", r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26"}}"#);
        assert_eq!(status, 200);
        let reply: Value = serde_json::from_str(&body).unwrap();
        assert_eq!(reply["result"]["protocolVersion"], "2025-03-26");
        assert_eq!(reply["result"]["capabilities"], json!({ "tools": {} }));

        assert_eq!(post(port, "", r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#).0, 202);

        let (_, body) = post(port, "", r#"{"jsonrpc":"2.0","id":2,"method":"tools/list"}"#);
        assert_eq!(serde_json::from_str::<Value>(&body).unwrap()["result"]["tools"][0]["name"], "search");

        let (_, body) = post(port, "", r#"{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"boom"}}"#);
        assert_eq!(
            serde_json::from_str::<Value>(&body).unwrap()["result"],
            json!({ "content": [{ "type": "text", "text": "没找到" }], "isError": true })
        );

        let (_, body) = post(port, "", r#"{"jsonrpc":"2.0","id":4,"method":"resources/list"}"#);
        assert_eq!(serde_json::from_str::<Value>(&body).unwrap()["error"]["code"], -32601);

        // A web page, by its Origin.
        assert_eq!(post(port, "Origin: https://example.com\r\n", r#"{"jsonrpc":"2.0","id":5,"method":"ping"}"#).0, 403);
    }
}
