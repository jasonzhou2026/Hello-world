# 训练与营养记录 PWA

本仓库是健身 PWA 的原始仓库，也是后续开发、版本保存和维护的统一入口。

## 版本入口

| 版本 | 源码与下载 | 说明 |
|---|---|---|
| V2（当前功能版本） | [V2 开发分支](https://github.com/jasonzhou2026/Hello-world/tree/codex/release-v2) · [v2.0.0 固定版本](https://github.com/jasonzhou2026/Hello-world/tree/v2.0.0) | 三动作训练矩阵、记录编辑、数据备份管理及三维肌群图 |
| V1（初版） | [v1.0.0 固定版本](https://github.com/jasonzhou2026/Hello-world/tree/v1.0.0) | 最初的食物、营养、训练与周报功能 |

默认 `main` 分支保留 V1 应用源码，本次只补充说明。**使用或继续开发 V2，请先切换到 `codex/release-v2` 分支。** 打开上表的分支或标签后，可用绿色 Code 按钮中的 Download ZIP 下载对应源码；直接从当前 main 页面下载仍是 V1。

## 重复归档核对（2026-09-22）

先前新建的 `fitness-tracker` 私有仓库重复保存了本项目的源码压缩包。逐文件比对确认：

- 早期包中的 26 个已跟踪文件与 V1 提交 `2f698e645d30d60e21a0bcd2f75646307a802560` 完全相同。
- 当前包中的 40 个已跟踪文件与 V2 提交 `bc23b77eed85a395ecd041ec230e04e4f35ee821` 完全相同。
- 历史快照包包含的两个提交也分别对应上述 V1、V2；没有发现比 V2 更新的程序源码版本。

因此无需再往本仓库重复上传相同的源码 ZIP。后续健身 PWA 的源码和版本统一保存在 **Hello-world**；另一个仓库只保留既有归档备份，不再作为维护入口。原生 Swift HealthTracker 是单独项目，不并入本 PWA。

## 使用 V2

下载或切换到 V2 后，在含 `package.json` 的项目根目录运行：

```sh
npm run serve
```

此脚本调用 Python 3 的本地 HTTP 服务，需要本机安装 Node.js / npm 与 Python 3。也可直接运行：

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

浏览器打开 `http://127.0.0.1:4173/`。纯静态网站，无需编译。V2 的测试入口为 `npm test`，更完整的说明见 V2 分支 README。

用户记录存于浏览器 IndexedDB，不随源码仓库迁移。换设备前应从应用内导出备份。账号、云同步与 AI 食物识别不属于当前静态 V2。

## V1 原始说明

以下保留初版功能与运行说明，避免将 main 中的初版源码误认为 V2。

一个本地优先的健身与营养记录 PWA，支持手动记录食物、营养元素、训练数据、周报图表和 Excel 导出。

## 功能

- 食物记录：热量、蛋白质、碳水、脂肪、膳食纤维、糖、钠、钙、铁、镁、钾、锌、维生素 A/C/D/B12。
- 训练记录：力量训练动作、组数、次数、器械重量、训练时长；户外/其他训练时长、距离、强度。
- 自动计算：摄入热量、训练消耗估算、净热量、力量训练容量。
- 周报图表：摄入 vs 训练、净热量、蛋白质、力量容量、有氧距离、有氧时长。
- Excel 导出：包含总览、食物、训练、每日营养、周报数据。
- PWA：支持本地安装、离线缓存、IndexedDB 本地保存。

AI 食物识别与营养推断目前是后续计划功能，尚未接入线上模型。

## 本地运行

电脑本机访问：

```sh
npm run serve
```

打开：

```text
http://localhost:4173/
```

手机同 Wi-Fi 临时访问：

```sh
npm run serve:lan
```

然后在手机打开电脑局域网地址，例如：

```text
http://192.168.1.3:4173/
```

## 测试

```sh
npm test
```

## GitHub Pages 部署

这个项目是纯静态站点，不需要构建步骤。

1. 在 GitHub 创建一个空仓库。
2. 把本地项目推送到仓库的 `main` 分支。
3. 进入仓库 Settings -> Pages。
4. Source 选择 `Deploy from a branch`。
5. Branch 选择 `main`，目录选择 `/root`。
6. 保存后等待 GitHub Pages 发布。

发布地址通常是：

```text
https://你的用户名.github.io/仓库名/
```
