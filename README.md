# Figma Desk Tools

把采访、文献和图片排成作品集页面，再检查字体和英文。两款插件都支持中文和英文。

Build portfolio pages from interviews, sources and images, then review typography and English copy. Both plugins include Chinese and English interfaces.

| 插件 · Plugin | 用途 · Use |
| --- | --- |
| **排版台 · Layout Desk** | 左边放参考，右边填图文，生成可编辑的 Figma 画板。 Build an editable Figma frame beside a visual reference. |
| **校样台 · Proofdesk** | 批量调整字体、比较项目样式、核对英文，也可以用笔刷修整抠图边缘。 Edit type across layers, compare styles with a baseline, review English and refine image cutouts. |

## 下载与安装 · Download and install

[下载最新版 · Get the latest release](https://github.com/ZhichenGu/figma-desk-tools/releases/latest)

1. 在 **Assets** 下载 `LayoutDesk.zip` 或 `Proofdesk.zip`，解压到固定文件夹。 Download the ZIP for the tool you want and extract it to a permanent folder.
2. 在 Figma 桌面端打开设计文件，选择 **Plugins → Development → Import plugin from manifest…**，选中该文件夹的 `manifest.json`。 In a design file in the Figma desktop app, import the extracted manifest from the development plugins menu.
3. 启动插件，点右上角 **EN / 中文** 切换语言。 Launch the plugin and use **EN / 中文** to switch languages.

排版台附带的跨窗口截图助手适用于 Apple Silicon Mac。将助手和插件文件放在同一可写文件夹中，首次使用时打开助手，并按 macOS 提示允许屏幕录制。也可以直接导入参考图片。

The optional cross-window capture helper runs on Apple Silicon Macs. Keep it beside the plugin files in a writable folder, launch it once and grant screen recording access when macOS prompts. You can also import a reference image directly.

## 试用 · Try it

**排一页采访。** 在排版台选采访版式，点右侧照片框，再点「去画布选图文」选一张人像。同样填入受访者的原话。红点提示文字溢出。点「生成到 Figma」即可得到画板。

**Lay out an interview.** Choose an interview layout, select its photo area, then use **Pick from canvas** to add a portrait. Repeat with a quote. Red dots mark overflowing text. Choose **Create in Figma** to generate your frame.

**统一字号。** 在 Figma 选中画板，打开校样台，选择「字号」，点原值、填新值，再核对范围并应用。

**Standardise type sizes.** Select a frame, open Proofdesk, choose **Size**, pick an existing size and enter a new one. Review the affected text before applying the change.

## 参与开发 · Contributing

修改各插件目录里的 `ui.html` 和 `code.js`，重新启动本地开发插件即可试用。Edit the files in either plugin folder and relaunch the development plugin. Keep your local screenshot-helper pairing key private.

遇到问题，请在 [Issues](https://github.com/ZhichenGu/figma-desk-tools/issues) 附上插件名、版本、操作系统和复现步骤。 Include the plugin name, version, operating system and steps to reproduce when reporting an issue.

## 许可 · Licence

项目代码采用 [MIT](LICENSE)。分发副本时保留许可与版权声明，无需在产品界面展示作者姓名。公开版包含原创版式示意图。校样台的词表来源见 [Dictionary-Source.txt](Proofdesk/Dictionary-Source.txt)。

The project code is MIT licensed. Retain the licence and copyright notice when redistributing it. No visible author credit in your interface is required. Public templates use original schematic illustrations. Proofdesk includes a word list with its own source notice.
