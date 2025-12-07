![DF-Plugin](https://socialify.git.ci/DenFengLai/DF-Plugin/image?custom_language=JavaScript&description=1&font=Raleway&language=1&name=1&pattern=Plus&theme=Auto&logo=https%3A%2F%2Fgithub.com%2FDenFengLai.png)

[![Gitee stars](https://gitee.com/DenFengLai/DF-Plugin/badge/star.svg?theme=dark)](https://gitee.com/DenFengLai/DF-Plugin/stargazers)
[![Gitee forks](https://gitee.com/DenFengLai/DF-Plugin/badge/fork.svg?theme=dark)](https://gitee.com/DenFengLai/DF-Plugin/members)
[![GitHub stars](https://img.shields.io/github/stars/DenFengLai/DF-Plugin)](https://github.com/DenFengLai/DF-Plugin/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/DenFengLai/DF-Plugin)](https://github.com/DenFengLai/DF-Plugin/network)
![GitHub repo size](https://img.shields.io/github/repo-size/denfenglai/DF-Plugin)

![Nodejs](https://img.shields.io/badge/-Node.js-3C873A?style=flat&logo=Node.js&logoColor=white)
[![Gitmoji](https://img.shields.io/badge/gitmoji-%20😜%20😍-FFDD67.svg?style=flat-square)](https://gitmoji.dev)
[![license](https://img.shields.io/github/license/Denfenglai/DF-Plugin.svg?style=flat&logo=gnu)](https://github.com/Denfenglai/DF-Plugin/blob/v2/LICENSE)

[![DF-Plugin](https://img.shields.io/github/package-json/v/Denfenglai/DF-Plugin?label=DF-Plugin&color=green)](https://github.com/DenFengLai/DF-Plugin)
[![Miao-Yunzai V3](https://img.shields.io/github/package-json/v/yoimiya-kokomi/Miao-Yunzai?label=Miao-Yunzai&color=yellow)](https://github.com/yoimiya-kokomi/Miao-Yunzai)
[![TRSS-Yunzai](https://img.shields.io/github/package-json/v/TimeRainStarSky/Yunzai?label=TRSS-Yunzai&color=blue)](https://github.com/TimeRainStarSky/Yunzai)

## 💡 安装教程

> [!TIP]
> 
> TRSS-Yunzai用户请使用 `#安装DF`

- Github

```sh
git clone --depth=1 https://github.com/DenFengLai/DF-Plugin.git ./plugins/DF-Plugin
```

- Gitee镜像

```sh
git clone --depth=1 https://gitee.com/DenFengLai/DF-Plugin.git ./plugins/DF-Plugin
```

### 🔧 安装依赖

```sh
pnpm install -P
```

## 🤗 已实现的功能

<details><summary>随机图片</summary>

- #来张JK / 黑丝 / cos / 腿 ...
- #DF随机表情列表

> 随机发送一张图片

</details>

<details><summary>给主人带话</summary>

- #联系主人 + `消息内容`  

> #回复<内容> 或 #回复<消息标识><空格><内容>

</details>

<details><summary>随机表情戳一戳</summary>

> 戳一戳返回随机表情包和文本
> 使用 #DF安装图库 可安装图库到本地使用  
> 未安装图库将调用[XY-Api](https://ciallo.ciallo.pro/)
> 支持的表情包类型 → [戳我查看](./resources/json/FaceList.json)

</details>

<details><summary>Git仓库更新推送</summary>

> 推荐使用[锅巴插件](https://gitee.com/guoba-yunzai/guoba-plugin.git)进行配置

- `#检查仓库更新`: 检查有没有仓库更新（相当于主动触发定时逻辑）
- `#推送仓库更新`: 不管有没有更新都回复到当前会话，不会推送所有群组

</details>

<details><summary>图片外显</summary>

> 推荐使用[锅巴插件](https://gitee.com/guoba-yunzai/guoba-plugin.git)进行配置

- #开启/关闭图片外显
- #设置图片外显 + 文字

</details>

---

> 更多功能请使用 `#DF帮助`  
> 查看近期更改请使用`#DF版本`

## ⚙️ 插件配置

本插件已全面兼容[锅巴插件](https://gitee.com/guoba-yunzai/guoba-plugin.git)，推荐使用锅巴插件进行配置。

> 配置文件位于 `Yz/config/DF-Plugin.yaml`

## ✨ 贡献者

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-10-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

感谢这些了不起的人 ([emoji-key](https://allcontributors.org/emoji-key/#natural-language-processing)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/yeyang52"><img src="https://avatars.githubusercontent.com/u/107110851?v=4?s=100" width="100px;" alt="椰羊"/><br /><sub><b>椰羊</b></sub></a><br /><a href="#example-yeyang52" title="Examples">💡</a> <a href="https://github.com/DenFengLai/DF-Plugin/commits?author=yeyang52" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/TimeRainStarSky"><img src="https://avatars.githubusercontent.com/u/63490117?v=4?s=100" width="100px;" alt="时雨◎星空"/><br /><sub><b>时雨◎星空</b></sub></a><br /><a href="#mentoring-TimeRainStarSky" title="Mentoring">🧑‍🏫</a> <a href="https://github.com/DenFengLai/DF-Plugin/commits?author=TimeRainStarSky" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/qsyhh"><img src="https://avatars.githubusercontent.com/u/132750431?v=4?s=100" width="100px;" alt="其实雨很好"/><br /><sub><b>其实雨很好</b></sub></a><br /><a href="https://github.com/DenFengLai/DF-Plugin/commits?author=qsyhh" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://gitee.com/adrae"><img src="https://foruda.gitee.com/avatar/1706324987763497611/13205155_adrae_1706324987.png!avatar200?s=100" width="100px;" alt="Admilk"/><br /><sub><b>Admilk</b></sub></a><br /><a href="https://github.com/DenFengLai/DF-Plugin/commits?author=Admilkk" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://gitee.com/kesally"><img src="https://avatars.githubusercontent.com/u/110397533?v=4?s=100" width="100px;" alt="kesally"/><br /><sub><b>kesally</b></sub></a><br /><a href="https://github.com/DenFengLai/DF-Plugin/commits?author=kesally" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://gitee.com/shanhai233"><img src="https://foruda.gitee.com/avatar/1723727797498359874/8750220_shanhai233_1723727797.png!avatar200?s=100" width="100px;" alt="桃缘十三"/><br /><sub><b>桃缘十三</b></sub></a><br /><a href="https://github.com/DenFengLai/DF-Plugin/commits?author=shanhai233" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/hmexy"><img src="https://avatars.githubusercontent.com/u/112873708?v=4?s=100" width="100px;" alt="心愿XY"/><br /><sub><b>心愿XY</b></sub></a><br /><a href="https://github.com/DenFengLai/DF-Plugin/commits?author=hmexy" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Lovely-02"><img src="https://avatars.githubusercontent.com/u/83761116?v=4?s=100" width="100px;" alt="02"/><br /><sub><b>02</b></sub></a><br /><a href="https://github.com/DenFengLai/DF-Plugin/commits?author=Lovely-02" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/MapleLeaf2007"><img src="https://avatars.githubusercontent.com/u/122816807?v=4?s=100" width="100px;" alt="MapleLeaf"/><br /><sub><b>MapleLeaf</b></sub></a><br /><a href="https://github.com/DenFengLai/DF-Plugin/commits?author=MapleLeaf2007" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/GuGuNiu"><img src="https://avatars.githubusercontent.com/u/123828263?v=4?s=100" width="100px;" alt="MacacaTaurus"/><br /><sub><b>MacacaTaurus</b></sub></a><br /><a href="https://github.com/DenFengLai/DF-Plugin/commits?author=GuGuNiu" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

本段遵循 [all-contributors](https://github.com/all-contributors/all-contributors) 规范，欢迎任何形式的贡献！

## 💬 免责声明

1. 本项目仅供学习和交流使用，禁止用于任何商业用途及违法用途。

2. 项目中的图片、API等资源均来自互联网，如有侵权请及时联系开发者，我们会尽快处理删除相关内容。

## 📃 许可证

本项目遵循 [GNU General Public License v3.0](./LICENSE) 协议。

## 🍀 意见反馈

如果您对本插件有什么建议或使用遇到了问题欢迎对本项目提交[issues](https://github.com/DenFengLai/DF-Plugin/issues/new)。

## 🎨 参与贡献

如果您有兴趣对本项目做出贡献，请阅读[贡献指南](./CONTRIBUTING.md)。

## 👥 联系我们

- QQ交流群: [964193559](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=hGiK1lQOmbJzP7S0xm-00NKdNi9Oe8Ma&authKey=aQRGoOwAyQ%2BYZ%2BZ5QNKJegwf5Y%2BgYM3Y%2F3%2Fc61cSquEuoIPM1qKemM6ajHb0sRFk&noverify=0&group_code=964193559)

## ⭐ 支持本项目

如果你觉得本项目对你有帮助，请给本项目点一个star，你的鼓励是我们不断前进的动力。

## ❤️ 赞助作者

- [爱发电](https://afdian.com/a/DenFengLai)

## 💝 友情链接

- [TRSS.me](https://TRSS.me)
- [Yenai-Plugin](https://Yenai.TRSS.me)
- [DF-Poke](https://cnb.cool/denfenglai/poke)

## 🎁 特别鸣谢

- [XY-Api](https://ciallo.hxxn.cc)：提供戳一戳图片接口服务支持
- [素颜Api](https://api.suyanw.cn)：提供部分Api服务
