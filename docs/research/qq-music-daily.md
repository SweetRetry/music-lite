# QQ 音乐每日 30 首请求分析

调查日期为 2026-10-23。本次分析本机 QQ 音乐 11.10.0 与当前官方推荐页。已接入 NCM Lite 的每日推荐页。

每日 30 首分两步读取。先从推荐信息流找到“每日30首”卡片，再用卡片 ID 查询智能歌单曲目。原生客户端通过 `onPlayDaily30` 事件触发同一条网页链路。以下结论来自本机 arm64 代码、官方 JavaScript 与网络抓包。

## 一手来源

| 来源 | 定位 |
| --- | --- |
| 本机 `/Applications/QQMusic.app/Contents/MacOS/QQMusic` | `Info.plist` 版本为 11.10.0。`QMAppIntentManager` 的 arm64 方法地址见下文。 |
| [官方推荐页](https://i2.y.qq.com/n3/wk_v20/entry/index/recommend) | 本机可执行文件中的默认推荐页 URL，本次实际打开并抓取网络请求。 |
| [官方推荐页脚本](https://y.qq.com/n3/wk_v20/entry//recommend.chunk.bdf2a22fe.js?max_age=6048000) | 字符 27400 附近构造信息流请求。28900 附近查询歌单。80721 初始化第一页。81701 处理每日 30 事件。82792 播放歌单。85447 注册事件。 |

字符偏移从零开始，按 UTF-8 解码后的 Unicode 字符计数。哈希文件更新后需要重新定位。

## 原生入口与事件链

本机可执行文件包含默认推荐页 URL `https://i2.y.qq.com/n3/wk_v20/entry/index/recommend`。另有旧路径 `/y.qq.com/wk_v17/#/recommend` 的判断字符串。页面当前由 `wk_v20` 加载，但请求公共参数仍使用 `platform:"wk_v17"`，后者已在本次抓包中观察到。

arm64 静态分析得到以下链路。

1. `QMAppIntent_PlayDaily30` 对应系统快捷指令入口。`QMAppIntentManager.handleAppIntentAction_PlayDaily30` 的 IMP 为 `0x1000331fc`。
2. 该方法设置 `wantPlayDaily30=true`，调用 `handleAction_PlayDaily30`，并安排超时处理。
3. `handleAction_PlayDaily30` 的 IMP 为 `0x100033f84`。它先检查待播放标记、生命周期掩码 `3`、`LoginManager.loginOK` 与生命周期掩码 `0x10`。
4. 通过检查后，调用 `WebviewManager.getWebview:URL:`，参数为 `7` 和空 URL，再读取 `curWebview`。
5. 通过 `jsExcute:name:dicParam:` 向该 WebView 发出 `onPlayDaily30`，字典参数为空。该事件名的 CFString 地址为 `0x1023b2f80`。
6. 推荐页完成加载后，`lifeCycleFinishLoadRecommandWeb:` 会再次调用 `handleAction_PlayDaily30`。该方法的 IMP 为 `0x1000345f8`。

原生在 `loginOK` 不满足时清除待播放标记。以上代码没有直接构造每日曲目 RPC。它把读取与播放交给推荐页事件。

可用以下命令重新读取相关方法地址和指令。命令只读取 app bundle，不启动客户端，也不读取用户凭证。

```sh
otool -arch arm64 -ov /Applications/QQMusic.app/Contents/MacOS/QQMusic

otool -arch arm64 -tvV /Applications/QQMusic.app/Contents/MacOS/QQMusic |
  awk '$1 >= "00000001000331fc" && $1 < "00000001000332d8" || $1 >= "0000000100033f84" && $1 < "0000000100034318" || $1 >= "00000001000345f8" && $1 < "0000000100034604"'
```

## 第一步，读取推荐信息流

[推荐页脚本字符 27400 附近](https://y.qq.com/n3/wk_v20/entry//recommend.chunk.bdf2a22fe.js?max_age=6048000) 使用 `music.recommend.RecommendFeed.get_recommend_feed`。初次加载在字符 80721 处传入第一页和零个已加载货架。

```json
{
  "module": "music.recommend.RecommendFeed",
  "method": "get_recommend_feed",
  "param": {
    "direction": 0,
    "page": 1,
    "v_cache": [],
    "v_uniq": [],
    "s_num": 0
  }
}
```

请求采用 `POST https://u6.y.qq.com/cgi-bin/musics.fcg?_=毫秒时间戳&sign=zzc签名`。body 为包含 `comm` 与 `req_1` 的 JSON 字符串。本次抓包的 `Content-Type` 为 `application/x-www-form-urlencoded`，body 仍是原始 JSON，没有 `encoding=ag-1`。

本次匿名网页抓到的公共参数如下。

```json
{
  "format": "json",
  "ct": 6,
  "cv": 90000,
  "platform": "wk_v17",
  "uid": "",
  "guid": "",
  "inCharset": "utf-8",
  "outCharset": "utf-8",
  "notice": 0,
  "needNewCode": 1,
  "uin": 0,
  "g_tk_new_20200303": 5381,
  "g_tk": 5381
}
```

响应的核心路径为 `req_1.data.v_shelf`。`req_1` 是本次请求的批次键，调用方可自行命名。页面将服务端数据保存在 `state.data`。

后续分页调用将 `page` 增加，`direction` 改为 1，`s_num` 传当前已加载的 `v_shelf.length`。`v_cache` 与 `v_uniq` 仍为空数组。返回的 `load_mark===0` 时页面继续加载。该逻辑来自[推荐页脚本字符 27400、82090 至 82750](https://y.qq.com/n3/wk_v20/entry//recommend.chunk.bdf2a22fe.js?max_age=6048000)。

## 第二步，找到每日卡片并读取曲目

[推荐页脚本字符 81701](https://y.qq.com/n3/wk_v20/entry//recommend.chunk.bdf2a22fe.js?max_age=6048000) 的 `onPlayDaily30` 处理器执行以下选择。

```js
const shelf = data.v_shelf.find((item) => item.id === 301);
const card = shelf?.v_niche?.[0]?.v_card?.find(
  (item) => item.title === "每日30首"
);
```

找到卡片后，页面把卡片传给 `playPlayList`。卡片 `id` 是下一步请求的 `disstid`，不能把货架 ID `301` 当成歌单 ID。页面依据当前响应取该 ID，没有硬编码固定的每日歌单。

[推荐页脚本字符 28900 附近](https://y.qq.com/n3/wk_v20/entry//recommend.chunk.bdf2a22fe.js?max_age=6048000) 构造以下请求。

```json
{
  "module": "music.srfDissInfo.aiDissInfo",
  "method": "uniform_get_Dissinfo",
  "param": {
    "disstid": "<每日卡片id>",
    "userinfo": 1,
    "tag": 1,
    "guid": "客户端 guid"
  }
}
```

`disstid` 实际为 `parseInt(card.id,10)` 得到的数字。上面的字符串仅作占位，不可直接提交。`guid` 来自页面的 `getGuid()`。

歌曲位于对应子请求的 `data.songlist`。页面对该数组调用 `formatMusic`，并将卡片 `extra_info` 序列化到曲目的 `ext`。该请求没有 `begin`、`num` 或页码参数。[推荐页脚本字符 82792 附近](https://y.qq.com/n3/wk_v20/entry//recommend.chunk.bdf2a22fe.js?max_age=6048000) 将返回曲目交给原生 `playSong`，并为“每日30首”设置 `reqtype:1` 与 `DAY_30_PLAYLIST` 播放来源。

页面在[同脚本字符 85447](https://y.qq.com/n3/wk_v20/entry//recommend.chunk.bdf2a22fe.js?max_age=6048000) 注册 `onPlayDaily30`，然后通知原生推荐页已就绪。这与本机的加载完成回调形成对应。

## 登录与复现

[每日推荐探针](../../scripts/qq-music-daily-probe.mjs) 按上述两个步骤执行。默认匿名请求。加 `--client-login` 后读取本机官方 macOS 客户端已有登录，解析其 `AutoLoginUserInfo` 归档。脚本不输出登录票据或 Cookie。

```sh
node scripts/qq-music-daily-probe.mjs
node scripts/qq-music-daily-probe.mjs --client-login
```

本次成功重放时，探针在 `comm` 中加入账号、`authst` 和 `tmeLoginType`，并发送对应登录 Cookie。`g_tk` 与 `g_tk_new_20200303` 从票据计算。签名针对附带这些字段后的确切 JSON 字节生成。代码见[探针](../../scripts/qq-music-daily-probe.mjs)。本次没有逐字段消融，不能据此声称这些字段全部都是服务端的最小必需集合。

## 验证范围

本次已实际打开官方推荐页并抓到首屏 `get_recommend_feed` 请求。原生事件链已通过 arm64 静态分析与 Objective-C selector 解码确认。

| 实际重放 | 信息流顶层 / 子请求状态 | 曲目顶层 / 子请求状态 | 结果 |
| --- | --- | --- | --- |
| 匿名 | `0 / 0` | `0 / 10004` | 信息流给出每日卡片，曲目读取未成功。 |
| 复用本机官方客户端登录 | `0 / 0` | `0 / 0` | 卡片标题为“每日30首”，`playlist.songlist.length` 为 30。 |

这 30 条是第二步 `uniform_get_Dissinfo` 原始 `songlist` 的长度，不是推荐页所有卡片的总数。每日卡片 ID 来自同次登录信息流结果。本次没有验证跨日刷新、不同账户或已过期登录。

顶层 `code:0` 不能代替子请求成功判断。匿名信息流已成功，不能将每日推荐笼统描述为匿名不可读。当前已验证的是本次匿名曲目读取失败，复用已有登录后读取成功。

## 应用接入

[QQ 数据适配层](../../apps/desktop/src/api/qq.ts) 的 `daily()` 按上述顺序读取推荐卡片与曲目，再转换为带 `src:"qq"` 的 `Track`。未返回每日卡片或歌单 ID 无效时报告错误。

[音乐服务层](../../apps/desktop/src/providers.ts) 为两种音乐服务提供 `daily()`。[每日推荐页](../../apps/desktop/src/views/Daily.tsx) 据当前服务加载数据，缓存按服务、账号和日期隔离。播放来源也按服务区分。QQ 文案不声明尚未验证的刷新时刻。

接入使用现有原生层的默认客户端身份 `ct:11,cv:13020508` 和 `ag-1` 封装。测试桥接按 `qq.rs` 的通信参数执行实际 `qq.daily()`，真实接口返回 30 条有效的 QQ `Track`。没有修改 Rust 通信层。

[行为测试](../../scripts/test-qq-daily.mjs) 加载应用实际 TypeScript，覆盖每日卡片选择、歌曲转换、无卡片、无效 ID 和登录错误。运行方式如下。

```sh
node --test scripts/test-qq-daily.mjs
```

浏览器以模拟登录和曲目数据验证 QQ 页面显示 30 首、切换网易云后显示其推荐列表、切回 QQ 后缓存不串用，以及 QQ 推荐队列不会在网易云侧显示播放标记。
