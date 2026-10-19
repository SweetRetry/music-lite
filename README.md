# NCM Lite

网易云音乐的轻量客户端。只保留听歌、歌词、每日推荐、歌单、搜索，接口仍是网易云官方的。

```bash
pnpm install
pnpm dev     # 开发，打开 Tauri 窗口
pnpm build   # 打包到 apps/desktop/src-tauri/target/release/bundle
```

需要 Node、pnpm 和 Rust 工具链。

前提是官方 macOS 客户端已登录。NCM Lite 会读取它的 cookie 复用登录态，只在原生进程里用，不会进入网页层。

## 怎么来的

官方客户端 3.1.13 是 CEF 外壳。界面是 `Contents/Resources/resources.pack`，一个前面带 100 字节头的 zip，`unzip` 可以直接解开。
前端只调用 `fetch("/api/...")`，由原生层改写成加密的 `/eapi/` 请求。`apps/desktop/src-tauri/src/eapi.rs` 补的就是这层。

## 结构

- `apps/desktop` 是 Tauri 应用。`src` 是 React 界面，`src-tauri` 是 Rust 原生层，只暴露一个 `eapi` 命令。
- `packages/ui` 是 shadcn 组件和主题 token。加组件在这个目录跑 `pnpm dlx shadcn@latest add <name>`。

## 快捷键

按 `?` 在应用里查看。清单来自 `apps/desktop/src/shortcuts.ts`，改快捷键只改那一张表。
正在输入框里时，只有带 `⌘` 的导航和视图快捷键与 `Esc` 生效，空格、方向键和 `/` 留给输入。

播放

- 空格 播放或暂停
- `⌘→` `⌘←` 下一首、上一首
- `⌘↑` `⌘↓` 音量加大、减小
- `⌘⇧→` `⌘⇧←` 快进、快退 5 秒（不用单独的 `←` `→`，它们留给滑块和列表）
- `⌘L` 喜欢或取消喜欢当前歌曲

导航

- `⌘F` 或 `/` 搜索
- `⌘[` `⌘]` 后退、前进
- `⌘1` 每日推荐
- `⌘2` 我喜欢的音乐

视图

- `⌘⇧L` 展开或收起歌词，`Esc` 收起歌词，点某一行歌词跳到那里
- `Esc` 退出输入框
- `⌘⇧Q` 打开或关闭播放队列
- `⌘N` 新建歌单

列表

- `↑` `↓` 在歌曲列表里上下移动
- `Enter` 播放选中的歌曲

帮助

- `?` 快捷键清单

系统媒体键也可用。
