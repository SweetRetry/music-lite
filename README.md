# NCM Lite

网易云音乐的轻量客户端。只保留听歌、歌单、搜索，接口仍是网易云官方的。

```bash
bun install
bun run start   # http://127.0.0.1:4163
```

前提是官方 macOS 客户端已登录。NCM Lite 会读取它的 cookie 复用登录态，只存在内存里。

## 怎么来的

官方客户端 3.1.13 是 CEF 外壳。界面是 `Contents/Resources/resources.pack`，一个前面带 100 字节头的 zip，`unzip` 可以直接解开。
前端只调用 `fetch("/api/...")`，由原生层改写成加密的 `/eapi/` 请求。`src/server/eapi.ts` 补的就是这层。

## 快捷键

- `/` 或 `⌘F` 聚焦搜索
- 空格 播放或暂停
- `⌘←` `⌘→` 上一首、下一首
- 系统媒体键可用
