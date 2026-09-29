# iOS 架构与中国区上架复核

核对日期：2026-09-29。此文记录可验证的工程状态，不代表 Apple 审核通过。

## 应用架构

```text
PWA / 本地打包的 iOS WebView
  ├─ src/app.js：四个栏目、弹窗、记录编辑与交互
  ├─ src/domain/*：营养、训练、总览、报告、备份、小组件的纯计算
  ├─ src/storage/db.js：本机 IndexedDB，数据库版本 1
  ├─ src/export/*：本地生成 Excel、PDF、Word
  └─ iOS Capacitor 8.5.2
       ├─ FitnessViewController：复用同一套网页界面
       ├─ FitnessExportPlugin：系统分享 / 保存到“文件”
       └─ FitnessWidgetsPlugin：同步今日目标与完成日期
            └─ App Group 本地共享 UserDefaults
                 └─ FitnessWidgets：三种 WidgetKit 桌面小组件
```

`scripts/build-web.mjs` 只复制应用运行所需的静态资源，不把仓库、对话、密钥、测试或 node_modules 打包。`capacitor.config.json` 没有远程 `server.url`；首次安装即具备本地界面、字体和 3D 资源。原来的 GitHub Pages/PWA 仍从仓库根目录运行。原生应用更新走 App Store 构建，不加载远程可执行网页覆盖安装包。

依赖锁定 Capacitor core、iOS、CLI 8.5.2，Swift Package 锁定同版本和提交。官方稳定版支持 iOS 15+，本项目因原生 dialog、Array.at、CSS :has/dvh 使用把部署下限设为 iOS 15.4，并同时构建 iPhone/iPad。[Capacitor iOS 文档](https://capacitorjs.com/docs/ios)

### 构建 3：今日目标小组件

- 原生扩展 `com.jasonzhou.fitnesstracker.widgets` 通过一个 `WidgetBundle` 提供深灰进度、紫色圆环、深蓝开关三种 `StaticConfiguration`，各支持小号和中号。App 设置页的三个按钮用于预览；实际桌面样式由用户在系统小组件图库选择，可以同时添加多种样式。[Apple 小组件扩展](https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension)
- `FitnessWidgetsPlugin` 将实际本地今天的目标名称、说明、重量进度和完成日期同步到 `group.com.jasonzhou.fitnesstracker`。小组件不读取 WebView 的 IndexedDB，也不访问网络；共享容器只属于同一团队下加入该组的 App 与扩展。[Apple App Groups](https://developer.apple.com/documentation/xcode/configuring-app-groups)
- 完成状态使用逐日、只写入完成的独立键；网页端串行保存设置并合并完成日期，防止过时快照或旧备份撤销已完成状态。打卡不新增训练记录，不改变重量、时长或热量；深灰刻度和紫色圆环始终显示真实记录的重量进度。
- iOS 17 及以上通过 `Button(intent:)` 执行 `CompleteFitnessGoalIntent`，无需打开 App；深蓝开关和底部“点击完成任务”均可触发。iOS 15.4–16 使用 `widgetURL` 打开 App，标记实际当天完成并定位训练页。普通前台恢复只同步状态，不改变所在栏目。[Apple 交互式小组件](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities)、[Apple 小组件深链接](https://developer.apple.com/documentation/widgetkit/linking-to-specific-app-scenes-from-your-widget-or-live-activity)
- 时间线预先包含下一次本地午夜的重置条目；前台恢复和系统显著时间变化会触发同步。系统仍决定时间线重新加载的实际时机，不能将刷新请求描述为定时后台常驻任务。系统着色或透明外观也可能调整参考设计的颜色。[Apple 时间线刷新](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date/)、[Apple 小组件着色外观](https://developer.apple.com/documentation/widgetkit/optimizing-your-widget-for-accented-rendering-mode-and-liquid-glass)
- App 与扩展都声明 App Group entitlement，分别使用 `Fitness Tracker App Store` 和 `Fitness Tracker Widgets App Store` 分发描述文件。本轮已按用户明确授权创建专用共享组并关联这两个目标，主 App 描述文件已重生成，扩展描述文件已创建；最终签名 IPA 的二者权限已核验。[Apple 能力与描述文件](https://developer.apple.com/help/account/identifiers/enable-app-capabilities)

## 数据与安全边界

- 食物、训练和设置保存在本机 IndexedDB；没有账号、服务器 API、分析 SDK、广告 SDK、云同步、HealthKit、定位或相机权限。
- 原生 App 与 Safari/PWA 的数据沙盒不同。现有网页记录通过“报告 → 数据管理 → JSON 备份 / 导入”迁移，安装原生 App 不会自动读到 Safari 数据。
- IndexedDB 支持事务，领域层与存储层分开；当前 schemaVersion 为 1。导入在写入前通过备份解析器校验。批量恢复尚不是跨全部记录的一次原子事务，故恢复前保留备份。
- 删除使用 `deletedAt` 标记，从界面和普通报告排除；数据清理并不等于物理擦除。删除应用会移除应用沙盒；用户自己导出的文件需要自行删除。
- 系统分享只在用户点导出后出现。桥接层仅接受 PDF/DOCX/XLSX/JSON 文件名，拒绝路径穿越；临时文件写入时使用 iOS 文件保护，分享结束或下一次启动时移除临时文件。用户选择的文件 App/分享目标可能将文件同步到其云服务。
- 应用端隐私清单声明不跟踪、不收集离机数据。构建 3 新增共享 `UserDefaults`，App 与 Widget 扩展的 `PrivacyInfo.xcprivacy` 均声明 `NSPrivacyAccessedAPICategoryUserDefaults`，理由为 `1C8F.1`，对应仅在同一 App Group 内读写共享偏好。已在构建 3 的最终签名 IPA 中再次核验 App 与 Widget 双方清单及 App Group 权限。[Apple 必需理由 API](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype)
- 记录含个人健身信息，应定期导出 JSON。当前没有应用级加密数据库、跨设备恢复或自动云备份，不能把本地存储描述为永久不会丢失。[Capacitor 存储说明](https://capacitorjs.com/docs/guides/storage)

Apple 对 App 隐私标签的“收集”以数据是否离开设备且可被开发者或合作方访问为核心。本版本代码支持“开发者不收集数据”的答题依据，最终应与支持渠道和实际运营保持一致。[Apple App 隐私说明](https://developer.apple.com/app-store/app-privacy-details/)

### 加密问卷依据

本版本未包含自行实现的加密算法或独立加密库。导出临时文件保护使用 iOS 系统 API，Capacitor 的 UUID 哈希调用 Apple 系统 `CommonCrypto.CC_SHA256`，网页记录 ID 使用系统 `crypto.randomUUID()`。这些没有构成独立于 Apple 操作系统的加密实现。Apple 明确说明，仅使用 Apple 操作系统内置加密的 App 无需在 App Store Connect 上传加密文件。[Apple 加密文档要求](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption)

若问卷列出“专有/非标准算法”“独立于 Apple 操作系统的标准算法”“两者”“以上都不是”，本构建的代码依据支持选择“以上都不是”；若界面先问是否使用任何加密，则沿“仅使用 Apple 操作系统提供的加密”回答。不要把系统加密描述为完全不存在。

构建 2 在 `Info.plist` 加入 `ITSAppUsesNonExemptEncryption=false`，声明应用不使用非豁免加密，避免未来每版重复填写同一问卷。构建 1 未包含此键，且本次浏览器中问卷保存控件无响应；新构建改为在包内直接提供已审计的合规结论。此键不会关闭或削弱 iOS 系统的文件保护。[Apple 合规键说明](https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption)

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

当前机器已配置分发签名身份，主 App 和小组件的 App Group 描述文件已分别重生成、核验并安装，可运行：

```sh
npm run ios:archive
```

此命令在构建 1/2/3 的签名归档和 IPA 导出已完整实测通过，输出 `artifacts/ios-release/FitnessTracker.ipa` 与 `FitnessTracker.xcarchive.zip`，不会自动上传。当前原生版本为 1.0.0 (3)，主 App 与扩展构建号一致。每次打包使用独立的临时工作目录，运行时打印工作目录与 `archive.xcresult` 构建日志位置。

本机实测工具链是 Xcode 26.6、iOS SDK 26.5、Node 24.16.0。Apple 自 2026-04-28 起要求 Xcode 26 或更高及 iOS 26 SDK；本机满足。部署目标 iOS 15.4 也符合 2026-09-09 起上传应用须以 iOS 13+ 为目标的要求。[Apple 当前提交要求](https://developer.apple.com/news/upcoming-requirements/)

系统 Git 能正确经过当前机器的网络代理；若 Xcode 内置 SCM 出现 TLS 错误，构建命令已使用 `-scmProvider system`。代理地址属于本机环境，不写入仓库或全局 Git 配置。

## 验证记录

构建 3 的网页测试共 88 项通过，新增覆盖实际今天与历史日期区分、跨日重置、重复打卡、过时原生响应合并、旧备份合并、深链接路由及三种预览。最终界面按参考图重做柔光渐变、点阵数字和控件，网页缓存版本为 v49。

- iPhone 17 Pro / iOS 26.5：系统小组件列表展示三种样式、各小号和中号；实际添加到主屏幕后，点击“点击完成任务”保持在主屏幕并立即显示“今日已完成”。冷启动 App 后进入当天训练页并同步完成状态，训练记录仍为空、时长仍为 0。重装测试构建及重启后完成状态保留。
- 模拟器验证 App Group 时使用 ad-hoc 签名及 entitlements；完全关闭签名的构建不能用于证明 App 与 Widget 跨进程共享有效。
- 原生检查通过：插件注册、本地持久化、合法/非法日期、闰日、次日进度归零、重复完成幂等、旧快照不覆盖完成状态。证据为 `artifacts/review/widgets-native-smoke.json`。
- 最终小号/中号无裁切，真实桌面不再出现白色外边；截图为 `widgets-native-{small,medium}-final.png`、`widget-home-final.png`、`widget-completion-synced-app.png`，均位于 `artifacts/review`。
- 最终 Release IPA 的主 App 与扩展均通过深度严格签名检查；包内 Bundle ID、构建号 3、专用 App Group、不可调试权限、双方隐私清单 `1C8F.1` 及 v49 资源已逐项核验。调试预览未进入 Release。

以下保留构建 1/2 的既有验证记录，不自动代表构建 3 的小组件已验证：

- Swift 原生工程：iOS 26.5 SDK 模拟器 Debug 构建、iOS 设备 Release 未签名归档均通过。
- iPhone 17 Pro / iOS 26.5：实际安装、冷启动、界面截图检查通过，安全区域和底栏正常。
- Debug 专用 `--fitness-smoke-test`：本地 `capacitor://localhost` 来源、应用界面加载、分享插件注册均通过；终止进程后重新启动，IndexedDB 持久化通过。测试只使用独立的 `fitness-native-smoke` 数据库，不触碰用户记录。
- iPhone 17 Pro 和 iPad Pro 13 英寸：实际生成 PDF（367,910 字节，`%PDF` 文件头）及 Word（7,292 字节，DOCX ZIP）并打开原生分享面板，显示文件缩略图与“保存到文件”；iPad 的分享弹出框锚点正常。
- 商店截图：`artifacts/app-store-screenshots` 包含 iPhone 17 Pro Max 6.9 英寸（1320×2868）和 iPad Pro 13 英寸（2064×2752）各四个栏目的实际空记录界面，RGB PNG 无透明通道；尺寸与格式按 [Apple 截图规格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) 核对。
- 首次安装为空记录并显示当天日期；原生 App 不自动写入演示记录。
- 构建 2：plist 和工程格式验证、签名归档、IPA 导出及深度签名检查通过；归档与 IPA 内均确认构建号为 2、`ITSAppUsesNonExemptEncryption` 为布尔值 false。比较构建 1/2 安装包中的全部 29 个网页资源，内容完全一致；本次只调整合规键与构建号，没有改动界面，也未重复运行与此改动无关的网页测试。
- 最低支持系统 iOS 15.4、真机、长时间低存储情形尚未实测；后续仍需补充真机验证记录、导入、四类导出、键盘、横竖屏和删除确认。
- 网页版 PDF 已实际下载；DOCX 文件结构与原生 Word 分享已验证。内置浏览器的网页版 Word/Excel 下载未生成可确认的新文件，延迟撤销 Blob URL 的临时实验也未解决，已撤回该实验；这部分浏览器下载兼容性仍需独立验证，不能算作通过。

## 签名交付

- App Store Connect 页面：[训练与营养记录（6817268320）](https://appstoreconnect.apple.com/apps/6817268320/distribution/ios/version/inflight)。
- 构建 3 IPA：`artifacts/ios-release/FitnessTracker-1.0.0-3.ipa`（1,718,977 字节），SHA-256：`a218cda9e5265a8538230b0fecd3439d7b48f8001bd1d64f3d712c3695818fe1`。已签名归档为 `FitnessTracker-1.0.0-3.xcarchive.zip`。
- 构建 2 IPA：`artifacts/ios-release/FitnessTracker-1.0.0-2.ipa`（1,495,428 字节），SHA-256：`f1800ca6b1e44069693731503ca42c00bd2d47f59cfd203c6045f54153c869ae`。
- 构建 2 已签名归档：`artifacts/ios-release/FitnessTracker-1.0.0-2.xcarchive.zip`。
- 构建 1 原 IPA `artifacts/ios-release/FitnessTracker-1.0.0-1.ipa`（1,495,098 字节）与归档仍保留，SHA-256 复核未变：`41c7417c253b8a2d1a51b3f0df6ebd3c74e5f47c15d671b580fc7fef9e373e69`。
- 正式 Bundle ID：`com.jasonzhou.fitnesstracker`，版本 1.0.0；当前签名交付为构建 3，新增扩展 Bundle ID 为 `com.jasonzhou.fitnesstracker.widgets`。
- 本项目位于 iCloud 管理的 Documents 目录，直接在此创建 `.app` 会被附加 FinderInfo 而导致 codesign 失败。新增 `npm run ios:archive` 会同步最新网页、将原生源码复制到系统临时目录后签名并导出，最后把 IPA 和压缩归档保存回 `artifacts/ios-release`；不会上传或创建新的凭据。
- 临时工作归档仅用于当前发布操作，持久保留以项目里的带版本号压缩归档为准。

## 中国区发布的实际状态与待补项

最新状态：2026-09-29 05:32（America/Chicago），用户明确授权替换旧审核后，构建 3 已关联至版本 1.0 并正式重新提交，Apple 显示“已提交 1 个项目”和“等待审核”。新提交 ID 为 `3596f837-87a2-4ac4-ba19-9916b16e9238`，[构建 3 审核提交](https://appstoreconnect.apple.com/apps/6817268320/distribution/reviewsubmissions/details/3596f837-87a2-4ac4-ba19-9916b16e9238)。商店描述和审核备注已加入三种小组件、尺寸选择、点击完成与本机共享说明。原构建 2 的提交显示“已移除”。中国大陆供应和通过审核后自动发布的设置保持有效；尚未审核通过或上架。截图凭证为 `artifacts/review/widget-build3-submitted.png` 与 `widget-build3-waiting-review.png`。

构建 3 于 05:22:31 上传成功（日志 `artifacts/review/fitness-ios-build3-upload.log`），随后处理完成并可提交，出口合规无阻断。以下保留此前构建 1/2 的发布准备记录：

1. 浏览器已核验团队 `9R87HUBYQH`。账户最初提示新版 Apple Developer 协议待接受；用户明确授权后已完成接受，账户历史显示 2026-09-29 接受，App Store Connect 阻塞横幅已消失。
2. 本机存在该团队的 Apple Distribution 签名身份。Bundle ID `com.jasonzhou.fitnesstracker` 已在该团队下注册；匹配的 `Fitness Tracker App Store` profile 已创建、核验并安装，正式 App 记录 ID 为 `6817268320`。已用既有 Apple Distribution 身份完成构建 1 和 2 的签名归档、App Store IPA 导出及深度签名验证。构建 1 于本机时间 2026-09-29 03:54:39 成功上传；包含加密合规键的构建 2 于 04:14:03 成功上传，日志明确返回 `Upload succeeded` / `Uploaded package is processing`。最新上传日志为 `/private/tmp/fitness-ios-build2-upload.log`。
3. 商店已保存 iPhone/iPad 各 4 张截图、健康健美分类、9+ 年龄问卷、非医疗设备、无数据收集、隐私网址、免费价格及仅中国大陆供应。构建 2 已处理完成并关联，出口合规预检通过。2026-09-29 约 04:20（本机 America/Chicago）正式提交，页面明确显示“已提交 1 个项目”和“正在等待审核”。[此前构建 2 提交（已移除）](https://appstoreconnect.apple.com/apps/6817268320/distribution/reviewsubmissions/details/d67cbd7f-330d-40b1-a8d0-f22512319091)，截图凭证 `artifacts/review/app-store-submitted.png`。已设置通过审核后自动发布；提交成功不代表审核已通过或已上架。[Apple 审核指南 5.1.1](https://developer.apple.com/app-store/review/guidelines/)
4. 构建 2 实际送审预检未把 ICP 备案号列为阻断，这不代表最终备案豁免。Apple 中国大陆可用性说明对适用 App 要求有效 ICP 备案号，并要求备案内容与简体中文商店元数据一致。工信部通知针对在境内从事互联网信息服务的 App，要求履行备案。本版本运行不依赖联网；**离线实现不能自动代替主管部门/Apple 对备案适用性的判断**。若后续要求备案号，需核验现有备案及正式名称，不得编造或借用网站编号。[Apple 中国大陆可用性说明](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)、[工信部 App 备案通知](https://ahca.miit.gov.cn/xxgkhlwgl/wzgl/art/2023/art_00c93cb439bd4943a0d8ab569561349b.html)
5. 该产品是本地个人记录与估算工具，商店描述不能声称医学诊断、医疗效果或测量精度；营养和运动消耗数字应保留估算属性。没有实际使用阿里云服务，因此不应为上线强行新增云端记录上传。
6. 原生分享、本地离线计算、记录编辑和报告构成实用功能，但 Apple 对 4.2 最低功能和应用体验仍独立评估；使用 Capacitor 本身不保证通过，也不等于必然被拒。[Apple 审核指南 4.2](https://developer.apple.com/app-store/review/guidelines/)

## 审核备注草稿

本应用无需登录。首次打开后可在“食物”添加饮食记录，在“训练”逐个添加力量动作或户外记录，并单独登记当日训练时长；“报告”展示按周汇总，可导出 PDF 图表、Word 文字、Excel 明细或 JSON 备份。数据在本机处理与保存，无远程账号或订阅。导出打开 iOS 系统分享窗口，可保存到“文件”。营养和运动消耗由用户输入及公式估算，仅用于个人记录。

构建 3 新增三种“今日目标”桌面小组件，在系统小组件图库搜索“训练与营养记录”后选择；App 设置页提供样式预览和添加说明。iOS 17 及以上支持直接点击完成任务；较早系统打开 App 后标记完成并进入当天训练页。完成状态仅在本机 App 与扩展间共享，按天保存，不生成运动或热量记录。
