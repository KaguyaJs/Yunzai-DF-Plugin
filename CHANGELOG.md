# Changelog

## [2.11.1](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/yunzai-df-plugin-v2.11.0...yunzai-df-plugin-v2.11.1) (2026-08-31)


### 🐛 Bug 修复

* **CodeUpdate:** 修复默认分支获取与请求路径 ([#69](https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues/69)) ([5385273](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/5385273d1cf5464d65ca55fc54a09fdaf3e3ca8e))
* **poke:** 修复 Miao-Yunzai 日志不显示插件名，TRSS-Yunzai 额外显示插件名 ([c8f69fa](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/c8f69fa8a091fc257b9ba0628d67cda274bba1bd))

## [2.11.0](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/yunzai-df-plugin-v2.10.0...yunzai-df-plugin-v2.11.0) (2026-07-28)


### ✨ 新功能

* **poke:** 支持自定义表情包接口地址格式 ([dcbaff2](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/dcbaff2607096334cecde7d96103a985c27f2f19))

## [2.10.0](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/yunzai-df-plugin-v2.9.1...yunzai-df-plugin-v2.10.0) (2026-06-20)


### ✨ 新功能

* Git推送 翻译 ([#63](https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues/63)) ([1c0ca86](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/1c0ca869deace1064dd152bdfa84cb04cfbaa94f))


### 🐛 Bug 修复

* 联系主人 冷却时间 ([#65](https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues/65)) ([22457c5](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/22457c5b1da30865e5c9010e3cd1923bb88dc68b))


### ♻️ 重构

* **cooldown:** 支持通过 0 禁用冷却机制并修复 Redis 脏数据拦截问题 ([22457c5](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/22457c5b1da30865e5c9010e3cd1923bb88dc68b))

## [2.9.1](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/yunzai-df-plugin-v2.9.0...yunzai-df-plugin-v2.9.1) (2026-05-21)


### 🐛 Bug 修复

* **CodeUpdate:** 修复推送锁 ([6d40712](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/6d407129697a479a1d8d8428b02e26454c4eb5e0))

## [2.9.0](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/yunzai-df-plugin-v2.8.1...yunzai-df-plugin-v2.9.0) (2026-04-27)


### ✨ 新功能

* **CodeUpdate:** 推送内容过多时支持分片截图发送 ([5259865](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/5259865532af3dd84e0c969080f8495dfbc4d702))

## [2.8.1](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/yunzai-df-plugin-v2.8.0...yunzai-df-plugin-v2.8.1) (2026-04-27)


### 🐛 Bug 修复

* 优化外显处理 ([a4a7857](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/a4a78577203ca5d166e3f5056efa390d38abfb3d))
* 细节优化 ([7cb1f7f](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/7cb1f7f2c46b8133e40139e4ba29f7092d4a5f35))

## [2.8.0](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/yunzai-df-plugin-v2.7.1...yunzai-df-plugin-v2.8.0) (2026-01-29)


### ✨ 新功能

* **Config:** 添加徽章样式配置并更新默认配置文件 ([a4a6040](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/a4a6040d1ded094622e986b9205ebfdb8ffba8f1))
* **picture:** 新增随机图片功能的详细配置选项 ([34ad357](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/34ad357a6c11d911b1a14c6427380549b3c2045e))
* **Poke:** 添加戳一戳图片API域名配置选项 ([ee1a960](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/ee1a9607344ce6bf126043e38e9a4831891ebb34))
* **Version:** 迁移实现DF版本 ([0da1407](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/0da14072e8c98baac3fbebdefc1ee46bff3f7fbe))
* 添加emoji更新脚本和依赖 ([5875ff1](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/5875ff1ef0cf1f9337b33174e9cca80f12d1c365))


### 🐛 Bug 修复

* **Changelog:** 使用marked实例化 ([15f85ae](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/15f85ae52a0bebfe7edcae55b69a8b2de8190ffc))
* **CodeUpdate:** Release 支持自动替换 emoji 表情码 ([1b424de](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/1b424deab8186eb8f4ddec872b1a4900b8103ccd))
* **CodeUpdate:** 修复可能推送空仓库的问题 ([fec72e6](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/fec72e6a3ab496bc07e353e5c5a6c9483e0920b7))
* **CodeUpdate:** 修复可能未配置 repos 导致的错误 ([4c5b740](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/4c5b7407f6700519b55a9e64128e1bda1df1305f))
* **CodeUpdate:** 修复可能未配置AutoPath排除列表导致的错误 ([7a7968c](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/7a7968c8a0258e75c04ac64313cd8068e44e79a0)), closes [#44](https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues/44)
* **CodeUpdate:** 修复可能未配置推送群组或QQ导致的错误 ([01f6a91](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/01f6a9137873c4e205256b5fc56e81e923a42b94))
* **CodeUpdate:** 修复定时任务不生效 ([7142348](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/71423482ca3515db54720d0d8405359e8ea13e3b))
* **CodeUpdate:** 修复缺少emoji.json导致的表情码无法替换 ([3f469e2](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/3f469e2253b08a0d011f9eb455505601c7237e19))
* **Face:** 修复随机表情自建图片类型不生效 ([3f13d6a](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/3f13d6a6b6080e6fe8cec576be41348f4b184586))
* **guoba:** 代码更新配置添加hideYear属性 ([edba7ea](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/edba7eadc08dec60bd2f6e4f32097f2cd91ca0b0))
* **picture:** 随机图片引用回复 ([162330a](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/162330a5c60f3edbdb494511ff47c26f0a6584ec))
* **poke:** 修复因缺少json文件导致的戳一戳文本模式异常 ([8ebb213](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/8ebb213f2ef962a6bf4e8cb172009fec4fe2b744))
* **poke:** 修复戳一戳随机类型黑名单逻辑判断写 ([ef9ff33](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/ef9ff336f973958b83d3ffae0b373b5c4828e092))
* **poke:** 替换已失效的api域名 ([987157c](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/987157c5add60c463adcc8c94bcb049f00de16bf))
* **update:** 方法名 ([19c0c73](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/19c0c7356df614160730000ca8decab4ec5207e6))
* **utils:** 修复版本检测中的引号问题 ([61fff2a](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/61fff2a5febf361f6b220f0f6f683e294bc8ede9))
* **utils:** 更新 GitRepo 工具函数实现 ([b28a102](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/b28a1023a9e081437b7bd2f728ffa48ce4a637c7))
* **Version:** 修复CHANGELOG.md不存在 ([f43cdfb](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/f43cdfb94243f4c629a7fe724f5dd44cc2a421fa))
* 迁移，支持锅巴配置 ([c40a483](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/c40a48381423bf22ee257e8c58125d4d45f01087))


### ⚡ 性能优化

* **data:** 优化表情载入 ([5852bc9](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/5852bc9082956dd09340ba511ce2e29196dbb36e))
* **poke:** 优化日志输出及返回判断 ([b3b4d06](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/b3b4d06b37334d2384d5e3ad2ddb225393791b4f))


### 📝 文档

* add 2078764727 as a contributor for ideas ([#50](https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues/50)) ([8c13319](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/8c13319aacdeafcb266bfd7fc57368d9f9d9b8b8))
* add cchanlan as a contributor for bug ([#10](https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues/10)) ([abdd9d5](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/abdd9d53ae7f46299b439344d79d4fbe41edcb73))
* add CSSZYF as a contributor for bug ([#46](https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues/46)) ([9c4bc7f](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/9c4bc7f5dfc1b5d60d08ad7bd18c3443e4ce428a))
* add devil233-ui as a contributor for bug ([#45](https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues/45)) ([fc273f8](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/fc273f83a0a8c4ecbf766c26dbf186deba6c4d64))
* add Leyanshi as a contributor for doc ([#8](https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues/8)) ([b4703d2](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/b4703d2f5763ae0371be6583def20c95e3171fea))
* add lilibsxz as a contributor for bug ([#52](https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues/52)) ([aa6a704](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/aa6a7047f4534445b17774c262244f7899687d2b))
* add qsm-mz-hn as a contributor for bug ([#48](https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues/48)) ([222efdc](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/222efdcdc053b9f000f9930bc699a41abfc2ec4b))
* add Sakura1618 as a contributor for bug ([#51](https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues/51)) ([8c76dcc](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/8c76dcc357d3c5a4a4db5726e18a098921835700))
* add scaking4 as a contributor for bug ([#49](https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues/49)) ([d1de894](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/d1de89430921a033c5c1f910b0d4abfb457e438d))
* add xiowoku as a contributor for ideas ([#47](https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues/47)) ([19a3ab6](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/19a3ab64f798144784648e335971809d7e249f29))
* 优化README ([096dc13](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/096dc135a6bbab69257a4e5a013edb76ae811640))
* 更新 README.md ([b84a7ca](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/b84a7cacb9c28b8a6b3f995e1d95fa77247d8c4f))
* 更新 README.md ([9543051](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/95430519d16d62e62dc5d817e26f2f9a802f0c58))
* 更新README ([fc05c19](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/fc05c19341bc3c582659806afd73fa3e0d4d94cf))


### ♻️ 重构

* **CodeUpdate:** 优化类名 ([81b5ac4](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/81b5ac43e44b9414dff3ac3fcacf3eee8d8a8360))
* **data:** 优化表情文件夹载入逻辑 ([6c5cdde](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/6c5cdded411f87f1a1006808f1c45afe0639ff3e))
* **utils:** 修改版本检测逻辑并注释掉未使用的源码目录常量 ([b16a751](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/b16a75124261290c1f29e82b271bf725e7c234c9))
* **Version:** DF版本展示最近五条 ([dad39e3](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/dad39e3a34f95bc6db3ca3697cb75cc71038baa6))
* 优化配置类型定义 ([34ad357](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/34ad357a6c11d911b1a14c6427380549b3c2045e))
* 细节优化 ([4fcd32d](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/4fcd32d142134d7b4d194ceac21a02c64e819433))


### 🏗️ 构建/打包

* 添加无压缩构建脚本 ([34ad357](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/34ad357a6c11d911b1a14c6427380549b3c2045e))


### 🤖 CI/CD 配置

* **release-please:** 更新 release-please 配置方式 ([69206e3](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/69206e37cfad132c24fdae09d8bfea3ee1bd54b9))
* **release-please:** 细节优化 ([3709f95](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/3709f955c866e9b05c2032c8e3bf92e571a8e2ae))
* **release-please:** 细节优化 ([df18907](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/df189073c114ea6592c29156f57f6bcf4a3ea2de))
* **release-workflow:** 更新工作流名称和发布分支 ([49ee498](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/49ee4989e7afd1e9ac32050b0dcbf0a7ef316316))

## [2.7.1](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/v2.7.0...v2.7.1) (2026-01-12)


### Bug Fixes

* **Changelog:** 使用marked实例化 ([15f85ae](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/15f85ae52a0bebfe7edcae55b69a8b2de8190ffc))

## [2.7.0](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/v2.6.4...v2.7.0) (2026-01-12)


### Features

* **Version:** 迁移实现DF版本 ([0da1407](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/0da14072e8c98baac3fbebdefc1ee46bff3f7fbe))


### Bug Fixes

* **Version:** 修复CHANGELOG.md不存在 ([f43cdfb](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/f43cdfb94243f4c629a7fe724f5dd44cc2a421fa))

## [2.6.4](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/v2.6.3...v2.6.4) (2026-01-12)


### Bug Fixes

* **CodeUpdate:** 修复可能推送空仓库的**问题** ([fec72e6](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/fec72e6a3ab496bc07e353e5c5a6c9483e0920b7))

## [2.6.3](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/v2.6.2...v2.6.3) (2026-01-06)


### Bug Fixes

* **CodeUpdate:** 修复可能未配置AutoPath排除列表导致的错误 ([7a7968c](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/7a7968c8a0258e75c04ac64313cd8068e44e79a0)), closes [#44](https://github.com/KaguyaJs/Yunzai-DF-Plugin/issues/44)

## [2.6.2](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/v2.6.1...v2.6.2) (2026-01-04)


### Bug Fixes

* **guoba:** 代码更新配置添加hideYear属性 ([edba7ea](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/edba7eadc08dec60bd2f6e4f32097f2cd91ca0b0))

## [2.6.1](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/v2.6.0...v2.6.1) (2026-01-03)


### Bug Fixes

* **picture:** 随机图片引用回复 ([162330a](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/162330a5c60f3edbdb494511ff47c26f0a6584ec))
* **utils:** 修复版本检测中的引号问题 ([61fff2a](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/61fff2a5febf361f6b220f0f6f683e294bc8ede9))

## [2.6.0](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/v2.5.3...v2.6.0) (2025-12-30)


### Features

* **picture:** 新增随机图片功能的详细配置选项 ([34ad357](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/34ad357a6c11d911b1a14c6427380549b3c2045e))
* **Poke:** 添加戳一戳图片API域名配置选项 ([ee1a960](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/ee1a9607344ce6bf126043e38e9a4831891ebb34))
* 添加emoji更新脚本和依赖 ([5875ff1](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/5875ff1ef0cf1f9337b33174e9cca80f12d1c365))


### Bug Fixes

* **CodeUpdate:** 修复可能未配置推送群组或QQ导致的错误 ([01f6a91](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/01f6a9137873c4e205256b5fc56e81e923a42b94))
* **Face:** 修复随机表情自建图片类型不生效 ([3f13d6a](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/3f13d6a6b6080e6fe8cec576be41348f4b184586))
* **update:** 方法名 ([19c0c73](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/19c0c7356df614160730000ca8decab4ec5207e6))


### Performance Improvements

* **data:** 优化表情载入 ([5852bc9](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/5852bc9082956dd09340ba511ce2e29196dbb36e))

## [2.5.3](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/v2.5.2...v2.5.3) (2025-12-25)


### Bug Fixes

* **poke:** 替换已失效的api域名 ([987157c](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/987157c5add60c463adcc8c94bcb049f00de16bf))

## [2.5.2](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/v2.5.1...v2.5.2) (2025-12-19)


### Bug Fixes

* **CodeUpdate:** 修复定时任务不生效 ([7142348](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/71423482ca3515db54720d0d8405359e8ea13e3b))
* **CodeUpdate:** 修复缺少emoji.json导致的表情码无法替换 ([3f469e2](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/3f469e2253b08a0d011f9eb455505601c7237e19))
* **poke:** 修复因缺少json文件导致的戳一戳文本模式异常 ([8ebb213](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/8ebb213f2ef962a6bf4e8cb172009fec4fe2b744))
* **poke:** 修复戳一戳随机类型黑名单逻辑判断写 ([ef9ff33](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/ef9ff336f973958b83d3ffae0b373b5c4828e092))
* **utils:** 更新 GitRepo 工具函数实现 ([b28a102](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/b28a1023a9e081437b7bd2f728ffa48ce4a637c7))


### Performance Improvements

* **poke:** 优化日志输出及返回判断 ([b3b4d06](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/b3b4d06b37334d2384d5e3ad2ddb225393791b4f))

## [2.5.1](https://github.com/KaguyaJs/Yunzai-DF-Plugin/compare/v2.5.0...v2.5.1) (2025-12-17)


### Bug Fixes

* 迁移，支持锅巴配置 ([c40a483](https://github.com/KaguyaJs/Yunzai-DF-Plugin/commit/c40a48381423bf22ee257e8c58125d4d45f01087))
