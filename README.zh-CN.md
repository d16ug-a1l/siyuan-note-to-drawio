# siyuan-note-to-drawio

[English](README.md)

![version](https://img.shields.io/badge/version-0.4.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)

一款[思源笔记](https://b3log.org/siyuan)插件：一键将当前笔记通过云端大模型（OpenAI 兼容的 chat completions 接口）生成为图表。支持两种输出格式：

- **draw.io 流程图** —— 保存为 `.drawio` 文件到 `assets/drawio/`，并以与 [siyuan-drawio-plugin](https://github.com/zt8989/siyuan-drawio-plugin) 完全兼容的格式嵌入笔记
- **Mermaid 图** —— 以 ` ```mermaid ` 代码块形式插入笔记，由思源原生渲染（由大模型自动选择 flowchart / 时序图 / 类图 / 状态图 / ER 图 / 甘特图 / 思维导图）

## 功能特性

- 预览优先的生成对话框：选择图表类型（drawio / Mermaid）、Mermaid 子类型（或由大模型自动识别）、插入位置（光标处 / 文档末尾），并可填写补充要求
- 内容范围选择：默认使用整篇文档，也可在层级块树中勾选一个或多个块，仅用选中内容生成
- 插入前预览生成结果——Mermaid 源码可编辑，drawio XML 只读
- 编辑器面包屑上的「AI 生成流程图」按钮打开对话框（两个命令分别以预选类型打开对话框，可自定义快捷键）
- 通过思源内核转发代理调用任意 OpenAI 兼容接口（DeepSeek、OpenAI、Moonshot 等），无跨域问题
- 生成的图形保存为 `<笔记标题>-<时间戳>-<随机后缀>.drawio`
- 在光标处插入 drawio 插件兼容的 iframe 块，双击即可在 draw.io 中编辑
- 插件设置中可配置 `baseURL` / `apiKey` / `model` / `temperature` / 默认图表类型 / 默认插入位置
- 中英文界面

## 截图

<!-- TODO: 补充截图 -->

## 安装

1. （可选，仅 drawio 流程图需要）先在集市安装并启用 **drawio 插件**（`siyuan-drawio-plugin`）——Mermaid 图由思源原生渲染，不依赖任何插件。
2. 从集市安装本插件，或手动构建（见下文「开发」）后复制到 `data/plugins/siyuan-note-to-drawio/`。

## 使用

1. 打开插件设置，配置：
   - **API Base URL** —— 例如 `https://api.deepseek.com/v1`
   - **API Key** —— 接口密钥
   - **模型** —— 例如 `deepseek-chat`
   - **温度** —— 默认 `0.2`
2. 打开一篇包含流程、步骤描述的笔记。
3. 点击编辑器面包屑上的 ✨ 按钮打开生成对话框（或执行「AI 生成流程图」/「生成 Mermaid 图」命令以预选类型打开）。
4. 在对话框中选择图表类型、Mermaid 子类型（默认自动识别）和插入位置，可填写补充要求；展开「内容范围」可勾选部分块代替整篇文档，然后点击「生成」。
5. 检查预览内容（Mermaid 源码可直接编辑），点击「插入笔记」：
   - drawio 流程图保存为 `.drawio` 文件并插入（双击可在 draw.io 中编辑）
   - Mermaid 图以 ` ```mermaid ` 代码块形式插入（由思源原生渲染）

## 隐私与安全

- API Key 仅保存在本地工作空间的插件私有存储（`data/storage/petal/`）中，随工作空间同步
- LLM 请求通过思源内核的正向代理发出，插件不连接任何其他服务器
- 生成的 `.drawio` 文件保存在 `assets/drawio/`，与普通资源文件一致

## 开发

需要 Node.js >= 24 和 npm。

```bash
npm install
npm run dev      # 开发构建（监听模式）
npm run deploy   # 复制开发构建产物到思源工作空间
```

`npm run deploy` 会将 `index.js`、`index.css`、`plugin.json`、`i18n/` 和 `README*.md` 复制到 `<工作空间>/data/plugins/siyuan-note-to-drawio/`。工作空间路径必须通过环境变量 `SIYUAN_WORKSPACE` 提供：

```bash
SIYUAN_WORKSPACE=/path/to/workspace npm run deploy
```

然后在思源中：**设置 → 集市 → 已下载 → 插件**，启用 `siyuan-note-to-drawio`（如未出现请重启思源）。

生产构建（生成 `dist/` 和 `package.zip`）：

```bash
npm run build
```

## 路线图

- drawio 支持更多图形类型（思维导图、时序图、ER 图）
- 重新生成 / 微调已有流程图块
- 流式生成进度展示

## 许可证

MIT © 2026 Lipeng
