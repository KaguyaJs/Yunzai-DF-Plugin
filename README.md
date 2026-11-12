![Yunzai-DF-Plugin](https://socialify.git.ci/KaguyaJs/Yunzai-DF-Plugin/image?description=1&font=Rokkitt&forks=1&issues=1&language=1&logo=https%3A%2F%2Fgithub.com%2FKaguyaJs.png&name=1&owner=1&pattern=Brick+Wall&pulls=1&stargazers=1&theme=Light)


## 安装插件

1. 准备[Miao-Yunzai](https://github.com/yoimiya-kokomi/Miao-Yunzai)或[TRSS-Yunzai](https://github.com/TimeRainStarSky/Yunzai)

2. 在 Yunzai 根目录**任选以下一条**运行

- 预览版 (即时更新)

```bash
git clone --depth=1 --branch preview https://github.com/KaguyaJs/Yunzai-DF-Plugin.git ./plugins/Yunzai-DF-Plugin
```

- 稳定版 (发版后更新)

```bash
git clone --depth=1 --branch release https://github.com/KaguyaJs/Yunzai-DF-Plugin.git ./plugins/Yunzai-DF-Plugin
```

<details><summary>镜像仓库 (国内推荐)</summary>
 
> 使用 Gitee 镜像仓库

- 预览版 (即时更新)

```bash
git clone --depth=1 --branch preview https://gitee.com/KaguyaJs/Yunzai-DF-Plugin.git ./plugins/Yunzai-DF-Plugin
```

- 稳定版 (发版后更新)

```bash
git clone --depth=1 --branch release https://gitee.com/KaguyaJs/Yunzai-DF-Plugin.git ./plugins/Yunzai-DF-Plugin
```

</details>

3. 运行依赖安装命令

```bash
pnpm install
```

## 如何使用

可使用 `#DF帮助` 获取帮助信息

<details><summary>随机图片</summary>

- #来张/看看 JK / 黑丝 / 白丝 / cos / 腿 ...
- #DF随机表情列表

> 随机图片功能
> 支持的随机表情别名和类型 → [戳我查看](./resources/json/FaceList.json)

</details>

<details><summary>给主人带话</summary>

- #联系主人 + `消息内容`  

> 主人收到消息后可：
> #回复<内容> 或 #回复<消息标识><空格><内容>

</details>

<details><summary>随机表情戳一戳</summary>

> 戳一戳返回随机表情包和文本
> 使用 #DF安装图库 可安装图库到本地使用  
> 未安装图库将调用 [XY-Api](https://ciallo.kaguya.fan/) 返回图片
> 支持的表情包类型 → [戳我查看](./resources/json/FaceList.json)

`#DF卸载图库` 会先显示占用大小，发送 `#确认卸载图库` 后删除本地图库。`#DF精简图库` 同样需要发送 `#确认精简图库`，只删除图库的 Git 历史并保留图片；精简后再次更新需要重新安装图库。

</details>

<details><summary>Git仓库更新推送</summary>

> 推荐使用[锅巴插件](https://gitee.com/guoba-yunzai/guoba-plugin.git)进行配置

- `#检查仓库更新`: 检查有没有仓库更新（相当于主动触发定时逻辑）
- `#推送仓库更新`: 汇总所有推送组中仓库的当前数据，去重并按配置分片后，在当前会话一次回复全部图片，不会推送所有群组
- 可在配置中开启 `CodeUpdate.Translate`，并通过 `TranslateApi` / `TranslateName` 自定义翻译接口和图片提示名称

图片默认使用“海盐蓝”，并保留“经典原版”等主题，可在锅巴的“Git仓库监听配置 → 推送图片主题”中自由选择，即时用于后续截图。已明确选择的主题继续保留。

| 配置值 | 主题 | 配色 |
| --- | --- | --- |
| `classic` | 经典原版 | 主题改造前的原始深色布局、字体和配色 |
| `dark` | 深空 | 深色背景、冰蓝点缀 |
| `light` | 晨光 | 明亮浅色卡片 |
| `ocean` | 海盐蓝（默认） | 清透蓝色 |
| `forest` | 松石绿 | 柔和绿色 |
| `sunset` | 暖砂橙 | 温暖砂色与橙色 |
| `lavender` | 薰衣草 | 柔和紫色 |
| `pink` | 樱花粉 | 柔和粉色与玫瑰色点缀 |

七套新主题支持进一步修改强调色、图片背景、卡片背景、主要文字、辅助文字、边框、布局宽度和卡片圆角。颜色留空时跟随主题；已填写的颜色会在新主题之间切换时继续生效，清空即可恢复预设。选择 `classic` 会使用独立保存的原版模板和样式，自定义项暂不生效，但会保留供下次切回新主题使用。也可在用户配置中设置：

```yaml
CodeUpdate:
  Theme:
    Name: ocean
    Accent: "#087f8c"
    Background: ""
    Surface: ""
    Text: ""
    Muted: ""
    Border: ""
    Width: 640
    Radius: 16
```

要恢复原版，只需将 `CodeUpdate.Theme.Name` 设为 `classic`。新主题颜色支持 `#RGB` 和 `#RRGGBB`。`Width` 为布局宽度（520～1000像素），实际输出会应用渲染精度缩放；`Radius` 为卡片圆角（0～28像素）。非法主题名回退海盐蓝，非法颜色忽略并使用主题预设。

手动 `#推送仓库更新` 会先合并各推送组并去除重复更新，再统一渲染；不同分支和不同事件继续保留。汇总后的条目达到 `multiPage` 阈值时仍使用分片截图，全部分片和链接在同一次回复中发送；设为 `-1` 可关闭分片。`Activity.BatchSize` 仅控制自动推送的消息批次，手动预览仍遵守每仓库 `InitialLimit` 与订阅筛选。自动检查继续按各接收者的订阅和批次投递、确认及失败补发。

支持监听提交（`commits`）、发布（`releases`）、PR（`pulls`）和 Issues（`issues`）。一个仓库条目的 `type` 是数组，锅巴使用多选框，同一仓库可以同时监听多个类型。也可在用户配置中添加：

```yaml
CodeUpdate:
  Auto: true
  FirstAdd: false
  Release:
    ShowAssets: true
    AssetLimit: 5
  Activity:
    PageSize: 100
    MaxPages: 20
    InitialLimit: 10
    BatchSize: 20
    BodyLimit: 600
    OverlapSeconds: 60
    SendLinks: true
    ShowDiff: false
    DiffMaxFiles: 3
    DiffMaxLines: 40
  List:
    - Group: [123456789]
      repos:
        - provider: GitHub
          repo: KaguyaJs/Yunzai-DF-Plugin
          type: [commits, releases, pulls, issues]
          branch: [main, dev]
          events: [opened, reopened, closed, merged, ready_for_review, commented]
          baseBranches: [main, dev]
          excludeBots: true
          includeDrafts: false
          labels: [bug]
          excludeLabels: [duplicate]
```

将示例群号替换为自己的群号；私聊使用 `QQ` 列表。`provider` 对应“GitApi配置”中的名称，认证令牌及接口地址沿用已有配置。同一仓库可以在不同群配置不同筛选条件，数据会合并获取，再分别筛选。

`branch` 仅控制提交监听；PR 使用 `baseBranches` 筛选目标分支，发布和 Issue 按仓库监听。锅巴分支框可以输入多个名称，按回车添加，也支持逗号分隔。

提交监听会获取上次检查到本轮 HEAD 之间的全部新增提交，按 SHA 去重并按父提交先于子提交的顺序推送；连续提交、相同时间戳和合并进来的旧日期提交也会保留。翻页固定本轮 HEAD，新出现的提交留到下轮。提交内容及各接收者的待发送记录会持久保存，网络、截图或发送失败后可继续补发，重启后也可恢复；已经成功确认的批次不会再次推送。首次静默和 `FirstAdd` 设置沿用原行为，手动预览只展示当前提交并保留自动进度。

同一张推送图片内，同平台、同仓库、同分支的多条提交共用一张卡片，顶部统一展示仓库、分支和提交数量，下方按原提交顺序编号排列；每条提交分别保留正文、作者、时间、SHA、翻译标记和变更统计。单条提交使用原布局，经典原版与全部新主题均支持。`BatchSize` 和 `multiPage` 仍按原始更新条数计算。

提交扫描共用 `CodeUpdate.Activity.PageSize`、`MaxPages` 和 `BatchSize`；扫描失败或达到上限但尚未确认完整时保留进度，可调高 `MaxPages` 后重试。CNB使用固定 SHA 的详情父链接口，节点预算为 `PageSize × MaxPages`。默认分支切换或完整历史确认旧提交已不可达时，会记录日志并从最新提交建立新基线，已有待补发内容继续保留；提交列表缺少父链信息的平台会记录提示，并按旧 SHA 的列表位置确定边界。

Release 默认忽略草稿，列表前面的草稿不会挡住正式发布。仓库条目设置 `includeDrafts: true` 后，检查范围包含接口返回的最新草稿，卡片显示“草稿 · 未发布”，尚无标签或发布时间的草稿也可展示。最新草稿的标题、正文、标签及附件变更，以及同一条发布从草稿转为正式，都会触发推送；仅更新时间或下载次数变化不会重复推送。预发布会显示“预发布”，转为正式版本也会触发推送；旧版ID游标会自动转换，升级时不会重推已有发布。不同接收者可使用不同草稿设置，共用一次列表获取，并分别保存推送进度；同一接收者匹配多个订阅时，相同发布只展示一次。草稿需要在“GitApi配置”中设置有读取权限的认证 Token；接口未返回的草稿无法监听。

`CodeUpdate.Release.ShowAssets` 控制是否在图片中展示附件，默认开启；`AssetLimit` 默认 5，展示前 5 个文件的名称和大小，超出部分显示“已折叠 N 个文件”。填 0 折叠全部，填 -1 展示全部。无附件时不展示附件区域，完整附件可在发布页查看。锅巴中可调整“Release展示附件”和“Release附件展开数量”；这些设置同样用于手动预览。

| 分支配置 | 提交监听范围 |
| --- | --- |
| 不填或 `branch: []` | 自动获取远程默认分支，无需开启额外开关 |
| `branch: [main]` | 仅 main |
| `branch: [main, dev]` | main 和 dev，分别保存进度 |
| `branch: [all]` | 每次检查分页获取全部远程分支，包括后来新增的分支 |

手工配置也兼容 `branch: main`、`branch: "main,dev"`、`branch: all`。`all` 与其他名称同时出现时以全部分支为准；`branch: ["", dev]` 可同时监听默认分支和 dev。默认分支名称缓存五分钟后重新获取；默认分支或完整分支列表获取失败时跳过相应提交检查并保留进度，其他类型继续检查。清理无效数据遇到分支查询失败时会中止清理。

本地 Git 仓库扫描完成后，日志会按平台输出监听仓库数量和大致每小时 API 访问次数；仅配置手动仓库时也会在初始化输出。`CodeUpdate.RequestEstimateLog` 控制仓库请求统计日志，默认 `true`；设为 `false` 或在锅巴关闭“仓库请求统计日志”即可关闭估算输出，不影响自动检查和更新推送。估算依据 `CodeUpdate.Cron` 的检查频率，对多个群/私聊重复监听去重，每个提交分支及发布、PR、Issue 类型各计一次基础请求，另外计入 `all` 分支发现和默认分支查询（五分钟缓存）。例如每半小时检查一个固定分支的提交约为 2 次/小时；同仓库监听两个固定分支以及发布、PR、Issue，基础约为 10 次/小时。

`all` 分支数在本地扫描时尚不确定，日志先列出已知部分，远程检查完成后复用已有分支结果补充估算；仓库或分支数量变化时重新输出。统计本身不产生平台请求。提交增量扫描、分页（含 Release 草稿分页）、PR/Issue详情、评论、diff 和手动检查会增加实际次数；非每日定时规则使用未来 366 天的平均频率。关闭自动检查时预计自动访问量为 0。

初始化会自动将旧的单个 `type` 转为数组，兼容 `commit` 别名；单个分支转为数组。同一策略组内，同仓库且筛选条件和其他设置完全相同的条目会合并，提交分支也会合并。筛选条件不同的条目继续保留，可手工按需求调整，避免 PR 和 Issue 的筛选被混用。旧 `AutoBranch` 设置移除，空分支始终自动解析默认分支。原有提交、发布及 PR/Issue 推送记录继续使用。

迁移先衔接旧 Redis 游标，再等待配置保存成功，最后写入 `DF:ConfigMigration:CodeUpdate:v2`，不设置过期时间。存在标记时后续启动跳过迁移；迁移或保存失败会记录错误并在下次启动重试。该标记不属于无效推送数据清理范围。

| 事件 | 含义 |
| --- | --- |
| `opened` / `closed` / `reopened` | 新建 / 关闭 / 重新打开 |
| `merged` | PR 合并 |
| `ready_for_review` / `converted_to_draft` | PR 转为正式 / 转为草稿 |
| `edited` | 修改标题或正文 |
| `labeled` / `unlabeled` | 添加 / 移除标签 |
| `synchronize` | PR 来源分支出现新提交 |
| `commented` | 新增普通讨论评论，逐条推送 |

`events` 留空时，Issue 默认监听新建、关闭和重开，PR 另监听合并和转为正式。评论、标签、正文修改及新代码需要单独勾选；Review 和代码行评论不属于普通讨论评论。监听转为草稿时应开启 `includeDrafts`。

`labels` 匹配任一标签，`excludeLabels` 命中任一标签即排除；移除标签事件也会考虑移除前的标签。`authors` / `excludeAuthors` 按账号筛选，PR/Issue 事件按条目创建者匹配，评论按评论作者匹配。标签和作者账号忽略大小写，分支名区分大小写。上述筛选只对 PR/Issue 生效，自动扫描本地插件仍监听提交。

首次检查会完整建立条目基线。`FirstAdd: false` 时不发送历史活动；开启时最多推送每仓库 `InitialLimit` 条当前状态。`#推送仓库更新` 预览同样遵守筛选和条目上限，并且不会改变自动推送进度。卡片展示编号、状态、标签、分支、正文或评论摘要，PR 详情可用时还展示文件及增删行数；`SendLinks` 控制附带原始链接。

在锅巴开启“PR展示代码diff”（`CodeUpdate.Activity.ShowDiff: true`）后，PR 活动卡片和手动预览会展示文件路径、增删统计及代码差异，新增/删除行使用不同颜色。默认最多展开 `DiffMaxFiles: 3` 个文件、`DiffMaxLines: 40` 行（包含上下文）。超过任一上限、补丁过长或平台只提供部分差异时，自动收起代码并展示文件摘要。推送是图片，完整代码通过 PR 原文查看；开启 `SendLinks` 后消息会附上可点击的完整 diff 链接。

diff 仅在需要展示的 PR 活动中获取，Issue、普通评论和静默基线不请求 diff。代码保持原文，不参与自动翻译。diff 获取或版本确认失败时仍推送 PR 通知，并显示“Diff暂不可用”。失败待重试的消息保存当时的 diff，避免重试时混入 PR 的后续代码。GitHub、Gitee、Gitcode 使用文件接口，Gitea 使用原始 unified diff；二进制文件或平台省略的补丁会提示未提供文本差异。

PR/Issue 接口适配 GitHub、Gitee、Gitcode 和 Gitea 兼容接口，CNB 当前仅支持原有提交/发布功能。自建 Gitea 的 `provider` 名称应包含 `Gitea`，`ApiUrl` 指向 `https://你的域名/api/v1/repos`。各平台的访问权限和限流以实际接口为准，建议配置令牌。

自动检查按更新时间分页并回看 `OverlapSeconds` 秒；达到 `MaxPages` 且尚不能确认列表完成、网络失败或评论获取失败时保留原检查进度。大型仓库首次检查可能需要调高页数上限。包含 PR/Issue 的消息按 `BatchSize` 分批发送，每批独立确认。检测状态和待发送内容一起保存在 Redis，某个群失败后继续重试其原始消息，已经成功的群不会重复接收同一事件。

生命周期检测采用轮询快照比较，不能还原两次检查之间发生又撤回的中间状态；普通新评论有独立编号去重。发送成功但 Redis 确认失败时可能重发。若需要每一次状态操作的精确通知，应再接入事件时间线或 Webhook。

开发验证：`pnpm run test:code-update`。本地主题预览：`pnpm run preview:git-themes -- <输出目录>`，使用示例数据生成经典原版与七套新主题图片，不连接Redis或发送消息。

</details>

<details><summary>插件数据维护与卸载（主人）</summary>

Redis会保存仓库检查进度、各接收者的发送状态及待补发内容。占用随监听的仓库、分支、接收者和活动数量增加；长期发送失败时，待补发内容会持续积压，发送成功后再移除。联系主人记录会自动过期。删除订阅后遗留的仓库记录可使用无效数据清理命令移除。

| 命令 | 功能 | 上下文确认内容 |
| --- | --- | --- |
| `#DFRedis统计` | 查看插件Redis键数、大小和占用最大的5条记录，也支持 `#DFRedis大小` / `#DFRedis占用` | 无需确认 |
| `#DF清理无效数据` | 显示已不属于当前订阅的仓库记录数量和大小，确认时重新核对订阅 | `#确认清理` |
| `#DF清空Redis` | 显示大小后清空本插件全部Redis数据 | `#确认清空Redis` |
| `#DF卸载插件` | 显示Redis和文件大小、删除范围，确认后卸载并自动重启Yunzai | `#确认卸载插件` |

删除需要在120秒内由发起操作的主人，在同一机器人、同一会话中发送对应确认内容，发送其他内容取消。预览时不会删除数据，执行前会重新统计，并等待已经开始的插件写入任务结束；任务未能及时结束则取消本次操作。

统计优先使用 Redis 的 `MEMORY USAGE`，显示本插件各键的内存合计，不代表Redis进程总内存。服务器不支持该命令或权限不足时，统一显示字符串有效负载的字节估算，并标出无法测量的键数。

清空范围为本插件的 `DF:*` 键，包括推送进度、待补发消息、联系主人记录和配置迁移标记。订阅配置保留，下次检查按首次添加处理：`FirstAdd: false` 时建立静默基线，开启时按配置进行首次推送。尚未发出的积压消息会被删除，不能再补发。

卸载会删除插件目录（含本地修改、依赖和图库）、`config/<插件目录名>.yaml`、`data/html/<插件目录名>`、`temp/html/<插件目录名>`，以及共享 `data/ViewData` 中标记为本插件的调试JSON文件；完成后调用框架的重启功能。删除范围按插件归属核对，其他插件数据和Yunzai共享日志、缓存保留。若专用路径或其父目录是符号链接，操作会中止并显示具体路径，避免沿链接删除外部数据。

开发验证：`pnpm run test:maintenance`，使用模拟Redis、文件系统和重启接口，不会删除真实数据。

</details>

<details><summary>图片外显</summary>

> 推荐使用[锅巴插件](https://gitee.com/guoba-yunzai/guoba-plugin.git)进行配置
> 使用锅巴开关外显需要重启后生效

- #开启/关闭图片外显

</details>

<details><summary>原神关键词发图</summary>

当群内有人提到 `原神` 时自动回复一张表情包。

> 默认开启，若不喜欢可在配置中关闭

</details>

> [!NOTE]
> 关于随机表情图片接口格式  
> 接口请求格式为 `GET https://example.com/?name=[图片名称]`  
> 因此理论上只要允许通过 name 参数指定类型的接口均可填入配置中使用(无视掉的也行)  
> 返回格式需要是纯图片 
> 如果需要自建图片接口省事可以参考使用我用ai写的一个小项目 👉 [点击此处](https://github.com/DenFengLai/DF-Poke-Api)

## 修改配置

本插件各配置项已支持[锅巴插件](https://gitee.com/guoba-yunzai/guoba-plugin.git)，推荐使用锅巴插件进行配置修改。

## 贡献者

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-21-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

感谢这些了不起的人 ([emoji-key](https://allcontributors.org/emoji-key/#natural-language-processing)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/yeyang52"><img src="https://avatars.githubusercontent.com/u/107110851?v=4?s=100" width="100px;" alt="椰羊"/><br /><sub><b>椰羊</b></sub></a><br /><a href="#example-yeyang52" title="Examples">💡</a> <a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/commits?author=yeyang52" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/TimeRainStarSky"><img src="https://avatars.githubusercontent.com/u/63490117?v=4?s=100" width="100px;" alt="时雨◎星空"/><br /><sub><b>时雨◎星空</b></sub></a><br /><a href="#mentoring-TimeRainStarSky" title="Mentoring">🧑‍🏫</a> <a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/commits?author=TimeRainStarSky" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/qsyhh"><img src="https://avatars.githubusercontent.com/u/132750431?v=4?s=100" width="100px;" alt="其实雨很好"/><br /><sub><b>其实雨很好</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/commits?author=qsyhh" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://gitee.com/adrae"><img src="https://foruda.gitee.com/avatar/1706324987763497611/13205155_adrae_1706324987.png!avatar200?s=100" width="100px;" alt="Admilk"/><br /><sub><b>Admilk</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/commits?author=Admilkk" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://gitee.com/kesally"><img src="https://avatars.githubusercontent.com/u/110397533?v=4?s=100" width="100px;" alt="kesally"/><br /><sub><b>kesally</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/commits?author=kesally" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://gitee.com/shanhai233"><img src="https://foruda.gitee.com/avatar/1723727797498359874/8750220_shanhai233_1723727797.png!avatar200?s=100" width="100px;" alt="桃缘十三"/><br /><sub><b>桃缘十三</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/commits?author=shanhai233" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/hmexy"><img src="https://avatars.githubusercontent.com/u/112873708?v=4?s=100" width="100px;" alt="心愿XY"/><br /><sub><b>心愿XY</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/commits?author=hmexy" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Lovely-02"><img src="https://avatars.githubusercontent.com/u/83761116?v=4?s=100" width="100px;" alt="02"/><br /><sub><b>02</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/commits?author=Lovely-02" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/MapleLeaf2007"><img src="https://avatars.githubusercontent.com/u/122816807?v=4?s=100" width="100px;" alt="MapleLeaf"/><br /><sub><b>MapleLeaf</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/commits?author=MapleLeaf2007" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/GuGuNiu"><img src="https://avatars.githubusercontent.com/u/123828263?v=4?s=100" width="100px;" alt="MacacaTaurus"/><br /><sub><b>MacacaTaurus</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/commits?author=GuGuNiu" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Leyanshi"><img src="https://avatars.githubusercontent.com/u/237535251?v=4?s=100" width="100px;" alt="Leyanshi"/><br /><sub><b>Leyanshi</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/commits?author=Leyanshi" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/cchanlan"><img src="https://avatars.githubusercontent.com/u/128832869?v=4?s=100" width="100px;" alt="cchanlan"/><br /><sub><b>cchanlan</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues?q=author%3Acchanlan" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/devil233-ui"><img src="https://avatars.githubusercontent.com/u/69190444?v=4?s=100" width="100px;" alt="devil233"/><br /><sub><b>devil233</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues?q=author%3Adevil233-ui" title="Bug reports">🐛</a> <a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/commits?author=devil233-ui" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/CSSZYF"><img src="https://avatars.githubusercontent.com/u/63802741?v=4?s=100" width="100px;" alt="CSSZYF"/><br /><sub><b>CSSZYF</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues?q=author%3ACSSZYF" title="Bug reports">🐛</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/xiowoku"><img src="https://avatars.githubusercontent.com/u/96910853?v=4?s=100" width="100px;" alt="xiowoku"/><br /><sub><b>xiowoku</b></sub></a><br /><a href="#ideas-xiowoku" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/qsm-mz-hn"><img src="https://avatars.githubusercontent.com/u/108866283?v=4?s=100" width="100px;" alt="⁡ ⁡"/><br /><sub><b>⁡ ⁡</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues?q=author%3Aqsm-mz-hn" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/scaking4"><img src="https://avatars.githubusercontent.com/u/115682439?v=4?s=100" width="100px;" alt="scaking4"/><br /><sub><b>scaking4</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues?q=author%3Ascaking4" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/2078764727"><img src="https://avatars.githubusercontent.com/u/180080544?v=4?s=100" width="100px;" alt="2078764727"/><br /><sub><b>2078764727</b></sub></a><br /><a href="#ideas-2078764727" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://about.sakurax.top/"><img src="https://avatars.githubusercontent.com/u/106215893?v=4?s=100" width="100px;" alt="Sakura1618"/><br /><sub><b>Sakura1618</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues?q=author%3ASakura1618" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/lilibsxz"><img src="https://avatars.githubusercontent.com/u/159024210?v=4?s=100" width="100px;" alt="濁"/><br /><sub><b>濁</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues?q=author%3Alilibsxz" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/haanxuan"><img src="https://avatars.githubusercontent.com/u/120633018?v=4?s=100" width="100px;" alt="XxxX"/><br /><sub><b>XxxX</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/commits?author=haanxuan" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

本段遵循 [all-contributors](https://github.com/all-contributors/all-contributors) 规范，欢迎任何形式的贡献！

## 问题反馈

如果您在使用过程中遇到了Bug或有好的功能建议以及其他问题可以[加入交流群反馈](#加入交流群)或者创建一个[issues](https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues/new/choose)。

## 加入交流群

- [964193559](https://qm.qq.com/q/weRTbr0ye6)

## 许可证

本项目遵循 [GNU General Public License v3.0](./LICENSE) 协议。

## 免责声明

本项目仅供学习交流使用，禁止用于任何违法用途。

项目内资源来源于网络，如有侵权请联系项目管理员删除。

## 特别鸣谢

- [XY-Api](https://ciallo.kaguya.fan)：提供戳一戳图片接口服务支持
- [素颜Api](https://api.suyanw.cn)：提供部分Api服务
- [小小Api](https://xxapi.cn): 提供白丝图片接口服务
