import {
    Plugin,
    Setting,
    showMessage,
    fetchSyncPost,
    getAllEditor,
} from "siyuan";
import type {IProtyle} from "siyuan";
import "./index.scss";

const CONFIG_KEY = "drawio-ai-config.json";
const DRAWIO_ASSET_DIR = "assets/drawio";
const MAX_CONTENT_LENGTH = 12000;

interface IDrawioAIConfig {
    baseURL: string;
    apiKey: string;
    model: string;
    temperature: string;
}

const DEFAULT_CONFIG: IDrawioAIConfig = {
    baseURL: "https://api.deepseek.com/v1",
    apiKey: "",
    model: "deepseek-chat",
    temperature: "0.2",
};

const SYSTEM_PROMPT = `你是一名流程图生成专家。请分析用户提供的笔记内容，提取其中的流程、步骤、条件判断等逻辑，输出一个 draw.io（mxGraph）格式的流程图 XML。

严格要求：
1. 只输出 XML 本身，不要输出任何解释文字，不要使用 markdown 代码块围栏。
2. 输出必须是未压缩的明文 XML，以 <mxGraphModel> 开头，以 </mxGraphModel> 结尾，不要包含 <mxfile> 或 <diagram> 外层包装。
3. <root> 内的前两个单元格必须固定为：
<mxCell id="0"/>
<mxCell id="1" parent="0"/>
4. 每个节点（顶点）使用 vertex="1" parent="1"，并带 <mxGeometry x=".." y=".." width=".." height=".." as="geometry"/>。布局自上而下，y 每次递增约 80-120，页面宽度约 400-800，节点之间不得重叠。
5. 每条连线使用 edge="1" parent="1"，并指定 source 和 target 为对应节点的 id，style 中必须包含 edgeStyle=orthogonalEdgeStyle。
6. 判断节点 style 使用 rhombus；开始/结束节点 style 使用 rounded=1；普通步骤使用矩形。
7. 节点和连线的文字标签通过 value 属性提供，使用笔记所使用的语言。
8. XML 属性值中的特殊字符必须转义（& 用 &amp;、< 用 &lt;、> 用 &gt;、" 用 &quot;）。

示例：
用户笔记内容："用户登录流程：开始，输入用户名和密码，然后校验是否通过；如果通过则进入首页，否则提示错误并重新输入；最后结束。"
输出：
<mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="2" value="开始" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="320" y="40" width="160" height="48" as="geometry"/>
    </mxCell>
    <mxCell id="3" value="输入用户名和密码" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="320" y="140" width="160" height="48" as="geometry"/>
    </mxCell>
    <mxCell id="4" value="校验是否通过" style="rhombus;whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="320" y="240" width="160" height="80" as="geometry"/>
    </mxCell>
    <mxCell id="5" value="进入首页" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="140" y="400" width="160" height="48" as="geometry"/>
    </mxCell>
    <mxCell id="6" value="提示错误并重新输入" style="whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="500" y="400" width="160" height="48" as="geometry"/>
    </mxCell>
    <mxCell id="7" value="结束" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="140" y="500" width="160" height="48" as="geometry"/>
    </mxCell>
    <mxCell id="8" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;" edge="1" parent="1" source="2" target="3">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="9" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;" edge="1" parent="1" source="3" target="4">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="10" value="通过" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;" edge="1" parent="1" source="4" target="5">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="11" value="不通过" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;" edge="1" parent="1" source="4" target="6">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="12" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;" edge="1" parent="1" source="6" target="3">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="13" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;" edge="1" parent="1" source="5" target="7">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

export default class NoteToDrawio extends Plugin {
    onload() {
        this.data[CONFIG_KEY] = {...DEFAULT_CONFIG};

        this.addBreadcrumbButton({
            id: "ai-flowchart",
            icon: "iconSparkles",
            title: this.t("aiFlowchart"),
            callback: (event, protyle) => {
                event.preventDefault();
                if (protyle.disabled) {
                    return;
                }
                this.generate(protyle);
            },
        });

        this.addCommand({
            langKey: "aiFlowchart",
            editorCallback: (protyle) => {
                this.generate(protyle);
            },
            callback: () => {
                const editors = getAllEditor();
                if (editors.length === 0) {
                    showMessage(this.t("noEditor"));
                    return;
                }
                this.generate(editors[0].protyle);
            },
        });

        const inputs: Record<keyof IDrawioAIConfig, HTMLInputElement> = {
            baseURL: null,
            apiKey: null,
            model: null,
            temperature: null,
        };
        const createInput = (key: keyof IDrawioAIConfig, type: string) => {
            const input = document.createElement("input");
            input.type = type;
            input.className = "b3-text-field fn__flex-center fn__size200";
            input.value = this.data[CONFIG_KEY]?.[key] ?? DEFAULT_CONFIG[key];
            inputs[key] = input;
            return input;
        };
        this.setting = new Setting({
            confirmCallback: () => {
                const config = {...DEFAULT_CONFIG, ...this.data[CONFIG_KEY]};
                for (const key of Object.keys(inputs) as (keyof IDrawioAIConfig)[]) {
                    if (inputs[key]) {
                        config[key] = inputs[key].value.trim();
                    }
                }
                this.saveData(CONFIG_KEY, config).catch((e) => {
                    showMessage(`[${this.name}] save data [${CONFIG_KEY}] fail: ` + e);
                });
            },
        });
        this.setting.addItem({
            title: this.t("settingBaseURL"),
            description: this.t("settingBaseURLTip"),
            createActionElement: () => createInput("baseURL", "text"),
        });
        this.setting.addItem({
            title: this.t("settingApiKey"),
            description: this.t("settingApiKeyTip"),
            createActionElement: () => createInput("apiKey", "password"),
        });
        this.setting.addItem({
            title: this.t("settingModel"),
            description: this.t("settingModelTip"),
            createActionElement: () => createInput("model", "text"),
        });
        this.setting.addItem({
            title: this.t("settingTemperature"),
            description: this.t("settingTemperatureTip"),
            createActionElement: () => createInput("temperature", "text"),
        });
    }

    async onLayoutReady() {
        let loaded = null;
        try {
            loaded = await this.loadData(CONFIG_KEY);
        } catch (e) {
            console.log(`[${this.name}] load data [${CONFIG_KEY}] fail: `, e);
        }
        if (loaded && typeof loaded === "object") {
            this.data[CONFIG_KEY] = {...DEFAULT_CONFIG, ...loaded};
        }
    }

    openSetting() {
        if (this.setting) {
            this.setting.open(this.displayName || this.name);
        }
    }

    private t(key: string): string {
        const value = this.i18n[key];
        return typeof value === "string" ? value : key;
    }

    private getConfig(): IDrawioAIConfig {
        return {...DEFAULT_CONFIG, ...this.data[CONFIG_KEY]};
    }

    private async generate(protyle: IProtyle) {
        const config = this.getConfig();
        if (!config.apiKey) {
            showMessage(this.t("missingApiKey"), 6000, "error");
            this.openSetting();
            return;
        }
        const rootID = protyle.block.rootID;
        if (!rootID) {
            showMessage(this.t("noEditor"), 6000, "error");
            return;
        }

        showMessage(this.t("fetchingContent"), 3000, "info");
        const mdRes = await fetchSyncPost("/api/export/exportMdContent", {id: rootID});
        if (mdRes.code !== 0) {
            showMessage(`${this.t("fetchContentFailed")}: ${mdRes.msg}`, 6000, "error");
            return;
        }
        let content = (mdRes.data?.content || "") as string;
        if (!content.trim()) {
            showMessage(this.t("docEmpty"), 6000, "error");
            return;
        }
        if (content.length > MAX_CONTENT_LENGTH) {
            content = content.slice(0, MAX_CONTENT_LENGTH);
        }
        const hPath = (mdRes.data?.hPath || "") as string;
        const docTitle = hPath.split("/").pop() || "flowchart";

        showMessage(this.t("generating"), 30000, "info");
        const replyText = await this.callLLM(config, content);
        if (replyText === null) {
            return;
        }

        const xml = this.extractXML(replyText);
        if (!xml) {
            showMessage(this.t("xmlExtractFailed"), 6000, "error");
            return;
        }
        if (!this.validateXML(xml)) {
            showMessage(this.t("xmlInvalid"), 6000, "error");
            return;
        }

        showMessage(this.t("savingFile"), 3000, "info");
        const blockID = this.newBlockID();
        const safeTitle = docTitle.replace(/[\\/:*?"<>|$&^.]/g, "").trim() || "flowchart";
        const filename = `${safeTitle}-${blockID}.drawio`;
        const assetPath = `${DRAWIO_ASSET_DIR}/${filename}`;
        const saved = await this.saveDrawioFile(assetPath, filename, xml);
        if (!saved) {
            return;
        }

        const html = `<iframe frameborder="0" style="width:100%;height:480px;" src="/plugins/siyuan-drawio-plugin/webapp/?tags=%7B%7D&lightbox=1&highlight=0000ff&edit=_blank&layers=1&toolbar-config=%7B%22refreshBtn%22%3A%7B%7D&title=${filename}#U${encodeURIComponent(assetPath)}"></iframe>
{: id="${blockID}" custom-data-assets="${assetPath}" }`;
        protyle.getInstance().insert(html, true, true);
        showMessage(this.t("insertSuccess"), 6000, "info");
    }

    private async callLLM(config: IDrawioAIConfig, content: string): Promise<string | null> {
        const url = config.baseURL.replace(/\/+$/, "") + "/chat/completions";
        let res;
        try {
            res = await fetchSyncPost("/api/network/forwardProxy", {
                url,
                method: "POST",
                timeout: 120000,
                contentType: "application/json",
                headers: [{Authorization: "Bearer " + config.apiKey}],
                payload: {
                    model: config.model,
                    temperature: Number(config.temperature) || 0.2,
                    messages: [
                        {role: "system", content: SYSTEM_PROMPT},
                        {role: "user", content: "请根据以下笔记内容生成流程图：\n\n" + content},
                    ],
                },
                payloadEncoding: "json",
                responseEncoding: "text",
            });
        } catch (e) {
            showMessage(`${this.t("llmRequestFailed")}: ${e}`, 6000, "error");
            return null;
        }
        if (res.code !== 0) {
            showMessage(`${this.t("llmRequestFailed")}: ${res.msg}`, 6000, "error");
            return null;
        }
        let body: any = res.data?.body;
        if (typeof body === "string") {
            try {
                body = JSON.parse(body);
            } catch (e) {
                showMessage(`${this.t("llmResponseInvalid")}: ${e}`, 6000, "error");
                return null;
            }
        }
        const text = body?.choices?.[0]?.message?.content;
        if (typeof text !== "string" || !text.trim()) {
            const detail = typeof body === "object" ? JSON.stringify(body).slice(0, 200) : String(body);
            showMessage(`${this.t("llmResponseInvalid")}: ${detail}`, 6000, "error");
            return null;
        }
        return text;
    }

    private extractXML(reply: string): string | null {
        const text = reply.replace(/```(?:xml)?/gi, "");
        const start = text.indexOf("<mxGraphModel");
        const endTag = "</mxGraphModel>";
        const end = text.lastIndexOf(endTag);
        if (start === -1 || end === -1 || end < start) {
            return null;
        }
        return text.slice(start, end + endTag.length);
    }

    private validateXML(xml: string): boolean {
        const doc = new DOMParser().parseFromString(xml, "text/xml");
        return !doc.querySelector("parsererror");
    }

    private newBlockID(): string {
        const now = new Date();
        const pad = (n: number) => (n < 10 ? "0" : "") + n;
        const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const letters = "abcdefghijklmnopqrstuvwxyz";
        let rand = "";
        for (let i = 0; i < 7; i++) {
            rand += letters[Math.floor(Math.random() * letters.length)];
        }
        return `${stamp}-${rand}`;
    }

    private async saveDrawioFile(assetPath: string, filename: string, xml: string): Promise<boolean> {
        const formData = new FormData();
        formData.append("path", `/data/${assetPath}`);
        formData.append("isDir", "false");
        formData.append("modTime", String(Date.now()));
        formData.append("file", new File([xml], filename, {type: "text/xml"}));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await fetchSyncPost("/api/file/putFile", formData as any);
        if (res.code !== 0) {
            showMessage(`${this.t("saveFileFailed")}: ${res.msg}`, 6000, "error");
            return false;
        }
        return true;
    }
}
