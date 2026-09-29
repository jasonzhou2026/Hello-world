# iOS 架构与中国区上架复核

核对日期：2026-09-29。此文记录可验证的工程状态，不代表 Apple 审核通过。

## 应用架构

```text
PWA / 本地打包的 iOS WebView
  ├─ src/app.js：四个栏目、弹窗、记录编辑与交互
  ├─ src/domain/*：营养、训练、总览、报告、备份的纯计算
  ├─ src/storage/db.js：本机 IndexedDB，数据库版本 1
  ├─ src/export/*：本地生成 Excel、PDF、Word
  └─ iOS Capacitor 8.5.2
       ├─ FitnessViewController：复用同一套网页界面
       └─ FitnessExportPlugin：系统分享 / 保存到“文件”
```

`scripts/build-web.mjs` 只复制应用运行所需的静态资源，不把仓库、对话、密钥、测试或 node_modules 打包。`capacitor.config.json` 没有远程 `server.url`；首次安装即具备本地界面、字体和 3D 资源。原来的 GitHub Pages/PWA 仍从仓库根目录运行。原生应用更新走 App Store 构建，不加载远程可执行网页覆盖安装包。

依赖锁定 Capacitor core、iOS、CLI 8.5.2，Swift Package 锁定同版本和提交。官方稳定版支持 iOS 15+，本项目因原生 dialog、Array.at、CSS :has/dvh 使用把部署下限设为 iOS 15.4，并同时构建 iPhone/iPad。[Capacitor iOS 文档](https://capacitorjs.com/docs/ios)

## 数据与安全边界

- 食物、训练和设置保存在本机 IndexedDB；没有账号、服务器 API、分析 SDK、广告 SDK、云同步、HealthKit、定位或相机权限。
- 原生 App 与 Safari/PWA 的数据沙盒不同。现有网页记录通过“报告 → 数据管理 → JSON 备份 / 导入”迁移，安装原生 App 不会自动读到 Safari 数据。
- IndexedDB 支持事务，领域层与存储层分开；当前 schemaVersion 为 1。导入在写入前通过备份解析器校验。批量恢复尚不是跨全部记录的一次原子事务，故恢复前保留备份。
- 删除使用 `deletedAt` 标记，从界面和普通报告排除；数据清理并不等于物理擦除。删除应用会移除应用沙盒；用户自己导出的文件需要自行删除。
- 系统分享只在用户点导出后出现。桥接层仅接受 PDF/DOCX/XLSX/JSON 文件名，拒绝路径穿越；临时文件写入时使用 iOS 文件保护，分享结束或下一次启动时移除临时文件。用户选择的文件 App/分享目标可能将文件同步到其云服务。
- 应用端隐私清单声明不跟踪、不收集离机数据；不调用需要额外理由声明的用户偏好、磁盘空间等 API。还需在归档后检查最终隐私报告，不能仅凭一份清单替代审核。
- 记录含个人健身信息，应定期导出 JSON。当前没有应用级加密数据库、跨设备恢复或自动云备份，不能把本地存储描述为永久不会丢失。[Capacitor 存储说明](https://capacitorjs.com/docs/guides/storage)

Apple 对 App 隐私标签的“收集”以数据是否离开设备且可被开发者或合作方访问为核心。本版本代码支持“开发者不收集数据”的答题依据，最终应与支持渠道和实际运营保持一致。[Apple App 隐私说明](https://developer.apple.com/app-store/app-privacy-details/)

## 本地构建

```sh
npm ci
npm test
npm run ios:sync
npm run ios:build
npm run ios:open
```

`ios:build` 是不签名的模拟器构建，输出 `artifacts/ios-build/Build/Products/Debug-iphonesimulator/App.app`。

```sh
npm run ios:archive:unsigned
```

该命令生成 `artifacts/FitnessTracker.xcarchive`，用于检查 Release 的二进制、资源、隐私清单和图标。**未签名归档不是可提交的 IPA，也不能装到真实 iPhone。** 正式分发须在 Xcode 选择已核验团队、最终 Bundle ID、有效分发证书及匹配的 provisioning profile 后 Archive / Distribute App。

本机实测工具链是 Xcode 26.6、iOS SDK 26.5、Node 24.16.0。Apple 自 2026-04-28 起要求 Xcode 26 或更高及 iOS 26 SDK；本机满足。部署目标 iOS 15.4 也符合 2026-09-09 起上传应用须以 iOS 13+ 为目标的要求。[Apple 当前提交要求](https://developer.apple.com/news/upcoming-requirements/)

系统 Git 能正确经过当前机器的网络代理；若 Xcode 内置 SCM 出现 TLS 错误，构建命令已使用 `-scmProvider system`。代理地址属于本机环境，不写入仓库或全局 Git 配置。

## 验证记录

- Swift 原生工程：iOS 26.5 SDK 模拟器 Debug 构建、iOS 设备 Release 未签名归档均通过。
- iPhone 17 Pro / iOS 26.5：实际安装、冷启动、界面截图检查通过，安全区域和底栏正常。
- Debug 专用 `--fitness-smoke-test`：本地 `capacitor://localhost` 来源、应用界面加载、分享插件注册均通过；终止进程后重新启动，IndexedDB 持久化通过。测试只使用独立的 `fitness-native-smoke` 数据库，不触碰用户记录。
- iPhone 17 Pro 和 iPad Pro 13 英寸：实际生成 PDF（367,910 字节，`%PDF` 文件头）及 Word（7,292 字节，DOCX ZIP）并打开原生分享面板，显示文件缩略图与“保存到文件”；iPad 的分享弹出框锚点正常。
- 商店截图：`artifacts/app-store-screenshots` 包含 iPhone 17 Pro Max 6.9 英寸（1320×2868）和 iPad Pro 13 英寸（2064×2752）各四个栏目的实际空记录界面，RGB PNG 无透明通道；尺寸与格式按 [Apple 截图规格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) 核对。
- 首次安装为空记录并显示当天日期；原生 App 不自动写入演示记录。
- 最低支持系统 iOS 15.4、真机、长时间低存储情形尚未实测；发布前仍须真机验证记录、导入、四类导出、键盘、横竖屏和删除确认。

## 中国区发布的实际状态与待补项

1. 浏览器已核验团队 `9R87HUBYQH`。账户最初提示新版 Apple Developer 协议待接受；用户明确授权后已完成接受，账户历史显示 2026-09-29 接受，App Store Connect 阻塞横幅已消失。
2. 本机存在该团队的 Apple Distribution 签名身份。Bundle ID `com.jasonzhou.fitnesstracker` 已在该团队下注册；匹配的 App Store profile 正在创建。正式 App 记录、签名构建上传及审核状态须以 App Store Connect 实际结果为准。
3. 隐私政策必须在 App 内和商店元数据可访问，支持 URL、审核联系资料、商店截图、年龄问卷、分类、版权、导出合规答题也要完整。仓库静态隐私/支持页面需实际发布后检查 URL。[Apple 审核指南 5.1.1](https://developer.apple.com/app-store/review/guidelines/)
4. Apple 中国大陆可用性说明对适用 App 要求有效 ICP 备案号，并要求备案内容与简体中文商店元数据一致。工信部通知针对在境内从事互联网信息服务的 App，要求履行备案。本版本运行不依赖联网；**离线实现不能自动代替主管部门/Apple 对备案适用性的判断**。需核验现有备案及正式名称，若界面要求备案号则先办理，不能编造或借用网站编号。[Apple 中国大陆可用性说明](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)、[工信部 App 备案通知](https://ahca.miit.gov.cn/xxgkhlwgl/wzgl/art/2023/art_00c93cb439bd4943a0d8ab569561349b.html)
5. 该产品是本地个人记录与估算工具，商店描述不能声称医学诊断、医疗效果或测量精度；营养和运动消耗数字应保留估算属性。没有实际使用阿里云服务，因此不应为上线强行新增云端记录上传。
6. 原生分享、本地离线计算、记录编辑和报告构成实用功能，但 Apple 对 4.2 最低功能和应用体验仍独立评估；使用 Capacitor 本身不保证通过，也不等于必然被拒。[Apple 审核指南 4.2](https://developer.apple.com/app-store/review/guidelines/)

## 审核备注草稿

本应用无需登录。首次打开后可在“食物”添加饮食记录，在“训练”逐个添加力量动作或户外记录，并单独登记当日训练时长；“报告”展示按周汇总，可导出 PDF 图表、Word 文字、Excel 明细或 JSON 备份。数据在本机处理与保存，无远程账号或订阅。导出打开 iOS 系统分享窗口，可保存到“文件”。营养和运动消耗由用户输入及公式估算，仅用于个人记录。
