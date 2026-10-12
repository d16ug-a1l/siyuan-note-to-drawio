# siyuan-note-to-drawio

[English](README.md)

一款[思源笔记](https://b3log.org/siyuan)插件：一键将当前笔记通过云端大模型（OpenAI 兼容的 chat completions 接口）生成为图表。支持两种输出格式：

- **draw.io 流程图** —— 保存为 `.drawio` 文件到 `assets/drawio/`，并以与 [siyuan-drawio-plugin](https://github.com/zt8989/siyuan-drawio-plugin) 完全兼容的格式嵌入笔记
- **Mermaid 图** —— 以 ` ```mermaid ` 代码块形式插入笔记，由思源原生渲染（由大模型自动选择 flowchart / 时序图 / 类图 / 状态图 / ER 图 / 甘特图 / 思维导图）

## 功能特性

- 编辑器面包屑上的「AI 生成流程图」按钮弹出菜单：生成 drawio 流程图或 Mermaid 图（两者同时注册为命令，可自定义快捷键）
- 通过思源内核转发代理调用任意 OpenAI 兼容接口（DeepSeek、OpenAI、Moonshot 等），无跨域问题
- 生成的图形保存为 `<笔记标题>-<时间戳>-<随机后缀>.drawio`
- 在光标处插入 drawio 插件兼容的 iframe 块，双击即可在 draw.io 中编辑
- 插件设置中可配置 `baseURL` / `apiKey` / `model` / `temperature`
- 中英文界面

## 截图

<!-- TODO: 补充截图 -->
![screenshot](preview.png)

## 安装

1. 先在集市安装并启用 **drawio 插件**（`siyuan-drawio-plugin`）——本插件依赖它来渲染和编辑图形。
2. 从集市安装本插件，或手动构建（见下文「开发」）后复制到 `data/plugins/siyuan-note-to-drawio/`。

## 使用

1. 打开插件设置，配置：
   - **API Base URL** —— 例如 `https://api.deepseek.com/v1`
   - **API Key** —— 接口密钥
   - **模型** —— 例如 `deepseek-chat`
   - **温度** —— 默认 `0.2`
2. 打开一篇包含流程、步骤描述的笔记。
3. 点击编辑器面包屑上的 ✨ 按钮，选择「生成 drawio 流程图」或「生成 Mermaid 图」（或执行对应命令）。
4. 稍等片刻：
   - drawio 流程图保存为 `.drawio` 文件并插入光标位置（双击可在 draw.io 中编辑）
   - Mermaid 图以 ` ```mermaid ` 代码块形式插入到光标所在块之后（由思源原生渲染）

## 开发

需要 Node.js >= 24 和 npm。

```bash
npm install
npm run dev      # 开发构建（监听模式）
npm run deploy   # 复制开发构建产物到思源工作空间
```

`npm run deploy` 默认将 `index.js`、`index.css`、`plugin.json`、`i18n/` 和 `README*.md` 复制到 `/path/to/workspace\data\plugins\siyuan-note-to-drawio\`。可通过环境变量 `SIYUAN_WORKSPACE` 覆盖工作空间路径：

```bash
SIYUAN_WORKSPACE=/path/to/workspace npm run deploy
```

然后在思源中：**设置 → 集市 → 已下载 → 插件**，启用 `siyuan-note-to-drawio`（如未出现请重启思源）。

生产构建（生成 `dist/` 和 `package.zip`）：

```bash
npm run build
```

## 路线图

- 自定义提示词模板
- drawio 支持更多图形类型（思维导图、时序图、ER 图）
- 重新生成 / 微调已有流程图块
- 流式生成进度展示

## 许可证

MIT © 2026 Lipeng
