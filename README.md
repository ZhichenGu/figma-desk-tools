# Figma Desk Tools

把采访、文献和图片排成作品集页面，再检查字体和英文。两款插件都支持中文和英文。

Build portfolio pages from interviews, sources and images, then review typography and English copy. Both plugins include Chinese and English interfaces.

| 插件 · Plugin | 用途 · Use |
| --- | --- |
| **排版台 • Layout Desk** | 左边放参考，右边填图文，生成可编辑的 Figma 画板。 Build an editable Figma frame beside a visual reference. |
| **校样台 • ProofDesk** | 批量调整字体、比较项目样式、核对英文，也可以用笔刷修整抠图边缘。 Edit type across layers, compare styles with a baseline, review English and refine image cutouts. |

## 下载与安装 · Download and install

[下载最新版 · Get the latest release](https://github.com/ZhichenGu/figma-desk-tools/releases/latest)

1. 在 **Assets** 下载 `LayoutDesk.zip` 或 `ProofDesk.zip`，解压到固定文件夹。 Download the ZIP for the tool you want and extract it to a permanent folder.
2. 在 Figma 桌面端打开设计文件，选择 **Plugins → Development → Import plugin from manifest…**，选中该文件夹的 `manifest.json`。 In a design file in the Figma desktop app, import the extracted manifest from the development plugins menu.
3. 启动插件，点右上角 **EN / 中文** 切换语言。 Launch the plugin and use **EN / 中文** to switch languages.

Layout Desk 附带的跨窗口截图助手适用于 Apple Silicon Mac。将助手和插件文件放在同一可写文件夹中，首次使用时打开助手，并按 macOS 提示允许屏幕录制。也可以直接导入参考图片。

The optional cross-window capture helper runs on Apple Silicon Macs. Keep it beside the plugin files in a writable folder, launch it once and grant screen recording access when macOS prompts. You can also import a reference image directly.

## 试用 · Try it

**在线找参考。** 在主页版式名称旁输入关键词，点「搜索」或按回车，打开「在线找参考图」。面板默认选中 Pinterest。点「在 Pinterest 搜索」打开网站，选好图片后用「截图作参考」带回排版台。也可以切换到维基共享资源或美国国会图书馆，沿用同一个关键词，在插件内预览和收藏参考图。收藏保存在当前 Figma 文件中。

**Find a reference.** Enter a keyword beside the layout name, then click **Search** or press Enter to open **Find images online**. Pinterest is selected by default. Choose **Search Pinterest** to open the website, then use **Capture reference** to bring an image back. Switch to Wikimedia Commons or the Library of Congress to browse with the same keyword and save references in the current Figma file.

**排一页采访。** 在 Layout Desk 选采访版式，点右侧照片框，再点「去画布选图文」选一张人像。同样填入受访者的原话。红点提示文字溢出。点「生成到 Figma」即可得到画板。

**Lay out an interview.** Choose an interview layout, select its photo area, then use **Pick from canvas** to add a portrait. Repeat with a quote. Red dots mark overflowing text. Choose **Create in Figma** to generate your frame.

**调整字体。** 在 Figma 选中画板，打开校样台，选择要调整的属性和原值。新字体和字形从兼容列表中选择。字号、行高和字间距可以选预设，也可以用 − / ＋ 微调。当选区只有一个原值时，校样台会自动选中它。核对受影响的文字后点「应用修改」。

**Adjust typography.** Select a frame, open ProofDesk and choose a property and its original value. Pick a compatible font family or style from the list. For size, line height and letter spacing, choose a preset or use − / ＋. A single original value is selected automatically. Review the affected text before applying.

**一键抠图。** 在画布上选中一张图片，进入「自动抠图」，点「一键抠图」按推荐设置移除底色。预览满意后点「应用到选图」。需要修边时展开「用笔刷修边」，擦除多余背景或还原误删部分。

**Remove a background.** Select an image on the canvas and choose **Remove background** in the cutout panel. Review the transparent preview and apply it to the selection. For edge corrections, open **Refine with brush** to erase remaining background or restore part of the subject.

## 参与开发 · Contributing

修改各插件目录里的 `ui.html` 和 `code.js`，重新启动本地开发插件即可试用。Edit the files in either plugin folder and relaunch the development plugin. Keep your local screenshot-helper pairing key private.

遇到问题，请在 [Issues](https://github.com/ZhichenGu/figma-desk-tools/issues) 附上插件名、版本、操作系统和复现步骤。 Include the plugin name, version, operating system and steps to reproduce when reporting an issue.

## 许可 · Licence

项目代码采用 [MIT](LICENSE)。分发副本时保留许可与版权声明，无需在产品界面展示作者姓名。公开版包含原创版式示意图。ProofDesk 的词表来源见 [Dictionary-Source.txt](ProofDesk/Dictionary-Source.txt)。

The project code is MIT licensed. Retain the licence and copyright notice when redistributing it. No visible author credit in your interface is required. Public templates use original schematic illustrations. ProofDesk includes a word list with its own source notice.
