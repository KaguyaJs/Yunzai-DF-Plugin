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

## 修改配置

本插件各配置项已支持[锅巴插件](https://gitee.com/guoba-yunzai/guoba-plugin.git)，推荐使用锅巴插件进行配置修改。

## 贡献者

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-14-orange.svg?style=flat-square)](#contributors-)
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
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/devil233-ui"><img src="https://avatars.githubusercontent.com/u/69190444?v=4?s=100" width="100px;" alt="devil233"/><br /><sub><b>devil233</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues?q=author%3Adevil233-ui" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/CSSZYF"><img src="https://avatars.githubusercontent.com/u/63802741?v=4?s=100" width="100px;" alt="CSSZYF"/><br /><sub><b>CSSZYF</b></sub></a><br /><a href="https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues?q=author%3ACSSZYF" title="Bug reports">🐛</a></td>
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
