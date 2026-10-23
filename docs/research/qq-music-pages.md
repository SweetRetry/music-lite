# QQ 音乐艺人页与专辑页请求分析

调查日期为 2026-10-23。本次只分析请求并提供重放探针，尚未接入 Music Lite。

本机 QQ 音乐 11.10.0 的页面默认入口指向 `wk_v17`。该页面将多个 `{module, method, param}` 请求合并后 POST 到 `musics.fcg`。抓到的艺人页与专辑页请求体均为 JSON 字符串，URL 带 `zzc` 签名。该结论来自本机可执行文件、官方页面脚本和实际网络请求。

## 一手来源

以下脚本均已下载并读取。字符偏移从零开始，按 UTF-8 解码后的 Unicode 字符计数。偏移用于定位当前带哈希的文件，不代表后续版本保持一致。

| 来源 | 本次使用的位置 |
| --- | --- |
| [官方艺人页脚本](https://y.qq.com/wk_v17/13_e55f8a690a0a8a0a47c8.js?max_age=2592000) | 字符 17795 附近为专辑分类。17961 为专辑列表请求。22575 为歌曲列表请求。35365 为艺人首页批量请求。36350 起读取返回值。 |
| [官方专辑页脚本](https://y.qq.com/wk_v17/38_0f645924c6b995bdfbc6.js?max_age=2592000) | 字符 1208 为曲目推荐标签。22333 为分页初值。23779 为首页批量请求。24330 起读取返回值。26400 起加载下一页。 |
| [官方公共请求层](https://y.qq.com/wk_v17/common_d04a06f270a9685c42e4.js?max_age=2592000) | 字符 368700 附近构造 `comm`。369100 起组装批量请求。425500 起加时间戳、签名和可选加密。 |
| 本机 `/Applications/QQMusic.app/Contents/MacOS/QQMusic` | `Info.plist` 版本为 11.10.0。arm64 `GetAlbumSongList` 的 IMP 为 `0x100103a64` 起。文末脚本可复查字符串与字段名。 |

本次浏览器抓包和原始响应保存在临时目录 `/tmp/ncm-qq-reverse/`。该目录不属于提交产物。可用仓库内的探针重新请求服务端。

## 页面入口

以下默认 URL 模板来自本机 11.10.0 可执行文件。`%@` 是原生客户端填入的字符串占位符。

```text
https://y.qq.com/wk_v17/#/singer_detail?tpl=wk&singermid=%@
https://y.qq.com/wk_v17/#/singer_detail/song?singermid=%@
https://y.qq.com/wk_v17/#/singer_detail/album?singermid=%@
https://y.qq.com/wk_v17/#/album_detail?tpl=wk&mid=%@
```

同一文件仍含旧页面模板 `/musicmac/v6/singer/detail.html?singerid=%@` 和 `/musicmac/v6/album/detail.html?albumid=%@`。本次未验证旧页面。

## 请求封装与签名

[公共请求层字符 369100 至 372500](https://y.qq.com/wk_v17/common_d04a06f270a9685c42e4.js?max_age=2592000) 把 `.request()` 链中的调用命名为 `req_0`、`req_1`，再附加 `comm`。服务端沿用这些键返回结果。

```http
POST https://u6.y.qq.com/cgi-bin/musics.fcg?_=<毫秒时间戳>&sign=<zzc签名>
Content-Type: application/x-www-form-urlencoded
Accept: application/json
Referer: https://y.qq.com/
```

实际 body 是 JSON 字符串。即使 `Content-Type` 写成表单类型，也不要将 body 转成表单键值对。以下公共参数来自本次匿名浏览器抓包。

```json
{
  "req_0": {
    "module": "music.musichallAlbum.AlbumInfoServer",
    "method": "GetAlbumDetail",
    "param": { "albumMid": "003RMaRI1iFoYd" }
  },
  "comm": {
    "g_tk": 5381,
    "uin": 0,
    "format": "json",
    "ct": 6,
    "cv": 1770,
    "platform": "wk_v17",
    "uid": "",
    "guid": ""
  }
}
```

[公共请求层字符 425500 至 426900](https://y.qq.com/wk_v17/common_d04a06f270a9685c42e4.js?max_age=2592000) 先对请求数据求签名，再决定是否根据 `needEnc` 封装 `ag-1`。本次页面抓包未启用该加密分支。无需为这些公开页面强制套用仓库现有的 `ag1_seal`。

探针先用 `JSON.stringify` 得到 body，再对同一字符串计算 `zzc`。空格、键顺序或转义方式改变后，必须重新签名。本次对抓包 body 重算的签名与 URL 参数逐字相同。实现见 [qq-music-probe.mjs](../../scripts/qq-music-probe.mjs)。

响应通常为以下结构。必须分别检查顶层和每个 `req_N.code`。[公共请求层字符 370000 至 371600](https://y.qq.com/wk_v17/common_d04a06f270a9685c42e4.js?max_age=2592000) 也是逐个处理子请求状态。

```json
{
  "code": 0,
  "req_0": { "code": 0, "data": {} },
  "req_1": { "code": 1000 }
}
```

## 艺人页

以下 `S` 表示艺人 `singerMid`。首页八个调用来自[艺人脚本字符 35365 至 36350](https://y.qq.com/wk_v17/13_e55f8a690a0a8a0a47c8.js?max_age=2592000)。返回路径来自同文件字符 36350 至 39900。表中的 `data` 均位于对应的 `req_N.data` 下。

| 次序 | module / method | param | 返回路径 |
| --- | --- | --- | --- |
| 0 | `music.musichallSinger.SingerInfoInter` / `GetSingerDetail` | `{singer_mids:[S],pic:1,group_singer:1,wiki_singer:1,ex_singer:1}` | `data.singer_list[0]`。其中 `basic_info` 含名字与 ID，`ex_info.desc` 为简介，`pic` 为图片，`wiki` 为 XML 字符串，`group_list` 为成员。 |
| 1 | `music.musichallSong.SongListInter` / `GetSingerSongList` | `{singerMid:S,begin:0,num:10,order:1}` | `data.songList[].songInfo`、`data.totalNum`。 |
| 2 | `music.musichallAlbum.AlbumListServer` / `GetAlbumList` | `{singerMid:S,order:1,num:30,begin:0}` | `data.albumList`、`data.total`。列表项含 `albumName`、`albumMid`、`publishDate`、`pmid`。 |
| 3 | `music.musichallAlbum.SelectedAlbumServer` / `SelectedAlbumList` | `{singerMid:S}` | `data.albumList`。 |
| 4 | `Concern.ConcernSystemServer` / `cgi_qry_concern_status` | `{vec_userinfo:[{usertype:1,userid:S}],opertype:5,encrypt_singerid:1}` | `data.map_singer_status[S]`。 |
| 5 | `music.SimilarSingerSvr` / `GetSimilarSingerList` | `{singerMid:S,num:6}` | `data.singerlist`。 |
| 6 | `MvService.MvInfoProServer` / `GetSingerMvList` | `{singerid:0,singermid:S,tagid:0,start:0,count:6,order:1}` | `data.list`、`data.total`。 |
| 7 | `music.sociality.KolFansVIPAccount` / `Singer2PkgUinStr` | `{SingerMIDs:[S]}` | `data.SingerMID2EncUin[S]`。 |

`Singer2PkgUinStr` 若返回非空映射，页面会继续调用 `music.lvz.MusicianGoodsSvr.GetMusicianMonthConf`，参数为 `{MusicianID:映射值,NoFilter:true,NeedNamePlateConfig:true}`，读取 `data.Conf.Goods`。该调用来自[艺人脚本字符 39872 起](https://y.qq.com/wk_v17/13_e55f8a690a0a8a0a47c8.js?max_age=2592000)，本次未单独重放。

### 歌曲与专辑分页

歌曲子页仍用 `GetSingerSongList`。初始参数为 `{singerMid:S,begin:0,num:30,order:1}`。`begin` 是偏移量，每次增加 `num`。`order:0` 对应界面“最新”，`order:1` 对应“最热”。切换排序时恢复 `begin:0`。这些行为来自[艺人脚本字符 22575 至 23950，以及 25000 至 25450](https://y.qq.com/wk_v17/13_e55f8a690a0a8a0a47c8.js?max_age=2592000)。

专辑子页用 `GetAlbumList`。默认 `{singerMid:S,order:0,num:30,begin:0}`。`order:0` 为“最新”，`order:1` 为“最热”。“全部”省略 `types`，录音室专辑传 `types:[0]`，EP 传 `[11]`，现场专辑传 `[1]`。`begin` 每次增加 30。代码在未返回非空列表时结束加载。这些行为来自[艺人脚本字符 17795 至 19800，以及 21450 至 21850](https://y.qq.com/wk_v17/13_e55f8a690a0a8a0a47c8.js?max_age=2592000)。

艺人首页的热门专辑使用 `order:1`。专辑子页默认使用 `order:0`。不能将两个默认值混用。

MV 子页先调用 `MvService.MvInfoProServer.GetSingerMvTag`，参数为 `{singermid:S}`，读取 `data.list`。列表调用为 `GetSingerMvList`，初始参数为 `{singermid:S,tagid:0,start:0,count:40,order:0}`。`start` 为偏移量。排序 `0` 为最新，`1` 为最热。来源为[艺人脚本字符 25800 至 29200](https://y.qq.com/wk_v17/13_e55f8a690a0a8a0a47c8.js?max_age=2592000)。

## 专辑页

以下 `A` 表示专辑 `albumMid`。首页五个调用来自[专辑脚本字符 23779 至 24350](https://y.qq.com/wk_v17/38_0f645924c6b995bdfbc6.js?max_age=2592000)。返回字段来自同文件字符 24330 至 26000。

| 次序 | module / method | param | 返回路径 |
| --- | --- | --- | --- |
| 0 | `music.musichallAlbum.OtherAlbumList` / `OtherAlbumList` | `{albumMid:A,order:0,num:6}` | `data.albumList`。 |
| 1 | `music.musichallAlbum.AlbumInfoServer` / `GetAlbumDetail` | `{albumMid:A}` | 整个 `data`。页面读取 `data.basicInfo`，其 `albumID` 是数字专辑 ID。 |
| 2 | `music.musichallAlbum.AlbumSongList` / `GetAlbumSongList` | `{albumMid:A,begin:0,num:1000,order:2}` | `data.songList[].songInfo`、每项的 `isThemeSong`、`data.totalNum`、`data.classicList`。 |
| 3 | `music.musicasset.AlbumFavRead` / `IsAlbumFan` | `{v_albumMid:[A]}` | `data.m_fan[A]`。 |
| 4 | `mall.MusicMallSvr` / `QueryAlbumDetail` | `{albummid:A}` | `data.buy`、`price`、`buypage`。注意参数是全小写 `albummid`。 |

曲目首次读取 1000 条。后续 `begin` 为上次请求的 `begin+num`，`num` 仍为 1000，`order` 固定为 2。页面将 `classicList` 中的分组下标调整后合并，再追加歌曲。空列表结束加载。该行为来自[专辑脚本字符 22333、26400 至 28000](https://y.qq.com/wk_v17/38_0f645924c6b995bdfbc6.js?max_age=2592000)。本次没有从 UI 标签或对照请求确定 `order:2` 的通用排序语义。

曲目加载后还会调用 `music.redpower.RecTagger.GetRecTags`。参数为 `{bid:99,query_ids:[歌曲数字ID的字符串],num:1}`。每批最多 100 个去重后的歌曲 ID。结果为 `data.data[]`，使用 `query_id` 和 `tag_info[0]`。来源为[专辑脚本字符 1208 至 2100](https://y.qq.com/wk_v17/38_0f645924c6b995bdfbc6.js?max_age=2592000)。

音频专辑分支会调用 `music.favor_system_read.get_favor_flag`。参数为 `{fav_type:1,vec_id:[String(albumID)]}`，读取 `data.vec_fav_flag[0].fav_flag`。数字专辑还可能读取购买页与销量 CGI。它们属于条件分支，本次没有覆盖其页面或登录状态。来源为[专辑脚本字符 26177 至 26400、28800 至 29800](https://y.qq.com/wk_v17/38_0f645924c6b995bdfbc6.js?max_age=2592000)。

## 原生专辑曲目请求

本机 arm64 `GetAlbumSongList` 类提供了另一个参数组合。以下是汇编还原结果，尚未直接重放原生参数。

```json
{
  "module": "music.musichallAlbum.AlbumSongList",
  "method": "GetAlbumSongList",
  "param": {
    "albumID": 123,
    "albumMid": "专辑 mid",
    "begin": 0,
    "num": -1,
    "order": 2
  }
}
```

`getModule` 的 IMP 为 `0x100103a64`。`getMethod` 为 `0x100103a70`。`addParam:` 为 `0x100103b48`，其中将 `num` 写为 `-1`，将 `order` 写为 `2`。`setAlbumID:albumMid:resultBlock:` 的 IMP 为 `0x100103a88`，将 `curBegin` 初始化为零。参数名 `albumID` 的大小写来自二进制 CFString，地址为 `0x1023af680`。这些位置可由 `otool -arch arm64 -ov` 与 `otool -arch arm64 -tvV` 复查。

`parseResponseData:` 的 IMP 为 `0x100103c8c`，读取 `data.totalNum`、`data.curBegin` 和 `data.songList[].songInfo`。本次静态分析不能证明 `num:-1` 对所有专辑都会返回全部曲目。网页首屏明确使用 `num:1000`。

## 复现

[公开页面探针](../../scripts/qq-music-probe.mjs) 不读取 Cookie 或本机登录信息。输出保留确切请求和原始 JSON 响应。可以只生成请求，也可以实际重放。

```sh
node scripts/qq-music-probe.mjs artist 0025NhlN2yWrP4
node scripts/qq-music-probe.mjs album 003RMaRI1iFoYd
node scripts/qq-music-probe.mjs songs 0025NhlN2yWrP4 '{"begin":30,"num":30,"order":0}'
node scripts/qq-music-probe.mjs albums 0025NhlN2yWrP4 '{"begin":0,"num":30,"order":0,"types":[11]}'
node scripts/qq-music-probe.mjs album 003RMaRI1iFoYd --dry-run
```

[本机静态取证脚本](../../scripts/qq-music-native-inspect.py) 只读取 app bundle。它解析 fat Mach-O 中的 arm64 段和 CFString，打印模块名、字段名及页面模板，并截取构造方法与 `addParam:` 的汇编。地址表限定为 11.10.0。发现其他版本会退出，避免把旧地址解释成新证据。

```sh
python3 scripts/qq-music-native-inspect.py
python3 scripts/qq-music-native-inspect.py /Applications/QQMusic.app
```

## 验证范围

本次浏览器打开周杰伦艺人页成功。样本 `singerMid` 为 `0025NhlN2yWrP4`。匿名重放的顶层 `code` 为 0，艺人信息、歌曲、专辑、精选专辑、相似艺人、MV 与粉丝映射子请求均为 0。关注状态子请求返回 1000。该结果来自抓包请求的实际重放，不能只看顶层状态判断关注接口成功。

本次浏览器打开专辑 `003RMaRI1iFoYd` 成功，页面显示《周杰伦的床边故事》及 10 首曲目。专辑页首屏抓包的曲目参数为 `begin:0,num:1000,order:2`。探针重放后，相关推荐、专辑资料、曲目与商城子请求均返回 0。收藏状态子请求返回 1000。10 首曲目已与预期名单逐条比对，首曲为《床边故事》，末曲为《爱情废柴》。

歌曲分页样本为 `begin:30,num:3,order:0`，实际返回 3 首且子请求状态为 0。专辑 EP 分类样本为 `types:[11],num:3,order:0`，实际返回《霍元甲》《J III MP3 Player》《寻找周杰伦》，三项的 `albumType` 均为 EP。直接进入艺人专辑子页的抓包先出现父页面八项请求，再出现单独的 `GetAlbumList`，参数为 `order:0,num:30,begin:0`。

专辑抓包还记录了评论数请求 `GlobalComment.GlobalCommentReadServer.GetCommentCount`。专辑参数为 `{request_list:[{biz_type:2,biz_id:"1458791"}]}`，其中 `biz_id` 是数字专辑 ID 的字符串。另有曲目评论请求，单项为 `{biz_type:1,biz_id:歌曲数字ID字符串,biz_sub_type:0}`。这些是首屏五项之后的附属读取。

原生 `num:-1`、旧版页面、已登录关注与收藏状态、数字专辑购买分支和全部 MV 分类未实测。本次也未修改应用路由、界面或数据适配层。探针生成的艺人请求 body 与官方抓包逐字节一致，签名逐字一致。
