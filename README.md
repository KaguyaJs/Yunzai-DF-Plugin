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

</details>

<details><summary>Git仓库更新推送</summary>

> 推荐使用[锅巴插件](https://gitee.com/guoba-yunzai/guoba-plugin.git)进行配置

- `#检查仓库更新`: 检查有没有仓库更新（相当于主动触发定时逻辑）
- `#推送仓库更新`: 不管有没有更新都回复到当前会话，不会推送所有群组
- 可在配置中开启 `CodeUpdate.Translate`，并通过 `TranslateApi` / `TranslateName` 自定义翻译接口和图片提示名称

支持监听提交（`commits`）、发布（`releases`）、PR（`pulls`）和 Issues（`issues`）。一个仓库条目的 `type` 是数组，锅巴使用多选框，同一仓库可以同时监听多个类型。也可在用户配置中添加：

```yaml
CodeUpdate:
  Auto: true
  FirstAdd: false
  Activity:
    PageSize: 100
    MaxPages: 20
    InitialLimit: 10
    BatchSize: 20
    BodyLimit: 600
    OverlapSeconds: 60
    SendLinks: true
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

| 分支配置 | 提交监听范围 |
| --- | --- |
| 不填或 `branch: []` | 自动获取远程默认分支，无需开启额外开关 |
| `branch: [main]` | 仅 main |
| `branch: [main, dev]` | main 和 dev，分别保存进度 |
| `branch: [all]` | 每次检查分页获取全部远程分支，包括后来新增的分支 |

手工配置也兼容 `branch: main`、`branch: "main,dev"`、`branch: all`。`all` 与其他名称同时出现时以全部分支为准；`branch: ["", dev]` 可同时监听默认分支和 dev。默认分支名称缓存五分钟后重新获取；默认分支或完整分支列表获取失败时跳过相应提交检查并保留进度，其他类型继续检查。清理无效数据遇到分支查询失败时会中止清理。

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

PR/Issue 接口适配 GitHub、Gitee、Gitcode 和 Gitea 兼容接口，CNB 当前仅支持原有提交/发布功能。自建 Gitea 的 `provider` 名称应包含 `Gitea`，`ApiUrl` 指向 `https://你的域名/api/v1/repos`。各平台的访问权限和限流以实际接口为准，建议配置令牌。

自动检查按更新时间分页并回看 `OverlapSeconds` 秒；达到 `MaxPages` 且尚不能确认列表完成、网络失败或评论获取失败时保留原检查进度。大型仓库首次检查可能需要调高页数上限。包含 PR/Issue 的消息按 `BatchSize` 分批发送，每批独立确认。检测状态和待发送内容一起保存在 Redis，某个群失败后继续重试其原始消息，已经成功的群不会重复接收同一事件。

生命周期检测采用轮询快照比较，不能还原两次检查之间发生又撤回的中间状态；普通新评论有独立编号去重。发送成功但 Redis 确认失败时可能重发。若需要每一次状态操作的精确通知，应再接入事件时间线或 Webhook。

开发验证：`pnpm run test:code-update`。

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
