import {
    Plugin,
    Setting,
    Dialog,
    showMessage,
    fetchSyncPost,
    getAllEditor,
} from "siyuan";
import type {IProtyle} from "siyuan";
import "./index.scss";

const CONFIG_KEY = "drawio-ai-config.json";
const DRAWIO_ASSET_DIR = "assets/drawio";
const MAX_CONTENT_LENGTH = 12000;
const MAX_BLOCK_LABEL_LENGTH = 40;

type TDiagramType = "drawio" | "mermaid";
type TInsertPosition = "cursor" | "end";
type TStage = "reading" | "readingBlocks" | "calling";
type TMermaidSubtype = "auto" | "flowchart" | "sequenceDiagram" | "classDiagram" |
    "stateDiagram-v2" | "erDiagram" | "gantt" | "mindmap";

interface IDrawioAIConfig {
    baseURL: string;
    apiKey: string;
    model: string;
    temperature: string;
    defaultType: TDiagramType;
    defaultInsertPosition: TInsertPosition;
}

interface IBlockNode {
    id: string;
    parentID: string;
    type: string;
    subtype: string;
    content: string;
    children: IBlockNode[];
}

const DEFAULT_CONFIG: IDrawioAIConfig = {
    baseURL: "https://api.deepseek.com/v1",
    apiKey: "",
    model: "deepseek-chat",
    temperature: "0.2",
    defaultType: "drawio",
    defaultInsertPosition: "cursor",
};

const DRAWIO_SYSTEM_PROMPT = `你是一名流程图生成专家。请分析用户提供的笔记内容，提取其中的流程、步骤、条件判断等逻辑，输出一个 draw.io（mxGraph）格式的流程图 XML。

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

const MERMAID_SYSTEM_PROMPT = `你是一名图表生成专家。请分析用户提供的笔记内容，选择最合适的 Mermaid 图表类型，输出对应的 Mermaid 代码。

严格要求：
1. 只输出 Mermaid 代码本身，不要输出任何解释文字，不要使用 markdown 代码块围栏。
2. 默认使用 flowchart TD（自上而下的流程图）；当笔记内容明显更适合其他类型时，可改用 sequenceDiagram（时序交互）、classDiagram（类结构）、stateDiagram-v2（状态流转）、erDiagram（实体关系）、gantt（时间安排）或 mindmap（思维导图）。
3. 节点和连线的文字标签使用笔记所使用的语言。
4. 保持简洁，节点数量不超过 30 个。
5. 第一行必须是图表类型声明（如 flowchart TD、sequenceDiagram 等）。
6. 节点文本中包含特殊字符（括号、引号等）时，用双引号包裹节点文本。

示例：
用户笔记内容："用户登录流程：开始，输入用户名和密码，然后校验是否通过；如果通过则进入首页，否则提示错误并重新输入；最后结束。"
输出：
flowchart TD
    A([开始]) --> B[输入用户名和密码]
    B --> C{校验是否通过}
    C -->|通过| D[进入首页]
    C -->|不通过| E[提示错误并重新输入]
    E --> B
    D --> F([结束])`;

const MERMAID_KEYWORD_PATTERN = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|mindmap|timeline|journey|gitGraph|quadrantChart|xychart-beta|block-beta)\b/;

const MERMAID_SUBTYPES: TMermaidSubtype[] = [
    "auto", "flowchart", "sequenceDiagram", "classDiagram", "stateDiagram-v2", "erDiagram", "gantt", "mindmap",
];

export default class NoteToDrawio extends Plugin {
    private lastDocTitle = "flowchart";

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
                this.openGenerateDialog(protyle);
            },
        });

        this.addCommand({
            langKey: "aiFlowchart",
            editorCallback: (protyle) => {
                this.openGenerateDialog(protyle, "drawio");
            },
            callback: () => {
                const protyle = this.getFocusedProtyle();
                if (protyle) {
                    this.openGenerateDialog(protyle, "drawio");
                }
            },
        });
        this.addCommand({
            langKey: "aiMermaid",
            editorCallback: (protyle) => {
                this.openGenerateDialog(protyle, "mermaid");
            },
            callback: () => {
                const protyle = this.getFocusedProtyle();
                if (protyle) {
                    this.openGenerateDialog(protyle, "mermaid");
                }
            },
        });

        const inputs: Record<keyof IDrawioAIConfig, HTMLInputElement | HTMLSelectElement> = {
            baseURL: null,
            apiKey: null,
            model: null,
            temperature: null,
            defaultType: null,
            defaultInsertPosition: null,
        };
        const createInput = (key: keyof IDrawioAIConfig, type: string) => {
            const input = document.createElement("input");
            input.type = type;
            input.className = "b3-text-field fn__flex-center fn__size200";
            input.value = this.data[CONFIG_KEY]?.[key] ?? DEFAULT_CONFIG[key];
            inputs[key] = input;
            return input;
        };
        const createSelect = (key: keyof IDrawioAIConfig, options: {value: string, label: string}[]) => {
            const select = document.createElement("select");
            select.className = "b3-select fn__flex-center fn__size200";
            for (const option of options) {
                const optionElement = document.createElement("option");
                optionElement.value = option.value;
                optionElement.textContent = option.label;
                select.append(optionElement);
            }
            select.value = this.data[CONFIG_KEY]?.[key] ?? DEFAULT_CONFIG[key];
            inputs[key] = select;
            return select;
        };
        this.setting = new Setting({
            confirmCallback: () => {
                const config = {...DEFAULT_CONFIG, ...this.data[CONFIG_KEY]};
                for (const key of Object.keys(inputs) as (keyof IDrawioAIConfig)[]) {
                    if (inputs[key]) {
                        config[key] = inputs[key].value.trim() as never;
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
        this.setting.addItem({
            title: this.t("settingDefaultType"),
            description: this.t("settingDefaultTypeTip"),
            createActionElement: () => createSelect("defaultType", [
                {value: "drawio", label: this.t("typeDrawio")},
                {value: "mermaid", label: this.t("typeMermaid")},
            ]),
        });
        this.setting.addItem({
            title: this.t("settingDefaultInsertPosition"),
            description: this.t("settingDefaultInsertPositionTip"),
            createActionElement: () => createSelect("defaultInsertPosition", [
                {value: "cursor", label: this.t("posCursor")},
                {value: "end", label: this.t("posEnd")},
            ]),
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

    private getFocusedProtyle(): IProtyle | null {
        const editors = getAllEditor();
        if (editors.length === 0) {
            showMessage(this.t("noEditor"));
            return null;
        }
        return editors[0].protyle;
    }

    private openGenerateDialog(protyle: IProtyle, presetType?: TDiagramType) {
        const config = this.getConfig();
        const subtypeOptions = MERMAID_SUBTYPES.map((subtype) => {
            const label = subtype === "auto" ? this.t("subtypeAuto") : subtype;
            return `<option value="${subtype}">${label}</option>`;
        }).join("");
        const dialog = new Dialog({
            title: this.t("dialogTitle"),
            content: `<div class="b3-dialog__content note-to-drawio">
    <div class="note-to-drawio__options">
        <label class="note-to-drawio__field">
            <span>${this.t("optType")}</span>
            <select class="b3-select note-to-drawio__type">
                <option value="drawio">${this.t("typeDrawio")}</option>
                <option value="mermaid">${this.t("typeMermaid")}</option>
            </select>
        </label>
        <label class="note-to-drawio__field note-to-drawio__subtype-field">
            <span>${this.t("optMermaidSubtype")}</span>
            <select class="b3-select note-to-drawio__subtype">${subtypeOptions}</select>
        </label>
        <label class="note-to-drawio__field">
            <span>${this.t("optPosition")}</span>
            <select class="b3-select note-to-drawio__position">
                <option value="cursor">${this.t("posCursor")}</option>
                <option value="end">${this.t("posEnd")}</option>
            </select>
        </label>
    </div>
    <input type="text" class="b3-text-field fn__block note-to-drawio__instructions" placeholder="${this.t("instructionsPlaceholder")}">
    <div class="note-to-drawio__scope">
        <div class="note-to-drawio__scope-header">
            <svg class="note-to-drawio__scope-arrow"><use xlink:href="#iconRight"></use></svg>
            <span>${this.t("scopePanelTitle")}</span>
            <span class="fn__space"></span>
            <span class="note-to-drawio__scope-summary">${this.t("scopeWholeDoc")}</span>
        </div>
        <div class="note-to-drawio__scope-body" style="display:none">
            <div class="note-to-drawio__scope-toolbar">
                <button class="b3-button b3-button--outline note-to-drawio__select-all">${this.t("selectAll")}</button>
                <button class="b3-button b3-button--outline note-to-drawio__clear">${this.t("clearSelection")}</button>
            </div>
            <div class="note-to-drawio__tree">${this.t("scopeLoading")}</div>
        </div>
    </div>
    <textarea class="b3-text-field fn__block note-to-drawio__preview" placeholder="${this.t("previewPlaceholder")}" spellcheck="false"></textarea>
    <div class="note-to-drawio__status">${this.t("statusReady")}</div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--outline note-to-drawio__generate">${this.t("btnGenerate")}</button>
    <button class="b3-button b3-button--outline note-to-drawio__regenerate" disabled>${this.t("btnRegenerate")}</button>
    <div class="fn__space"></div>
    <button class="b3-button b3-button--cancel note-to-drawio__cancel">${this.t("btnCancel")}</button>
    <button class="b3-button b3-button--text note-to-drawio__insert" disabled>${this.t("btnInsert")}</button>
</div>`,
            width: "720px",
        });

        const typeSelect = dialog.element.querySelector(".note-to-drawio__type") as HTMLSelectElement;
        const subtypeField = dialog.element.querySelector(".note-to-drawio__subtype-field") as HTMLElement;
        const subtypeSelect = dialog.element.querySelector(".note-to-drawio__subtype") as HTMLSelectElement;
        const positionSelect = dialog.element.querySelector(".note-to-drawio__position") as HTMLSelectElement;
        const instructionsInput = dialog.element.querySelector(".note-to-drawio__instructions") as HTMLInputElement;
        const previewArea = dialog.element.querySelector(".note-to-drawio__preview") as HTMLTextAreaElement;
        const statusElement = dialog.element.querySelector(".note-to-drawio__status") as HTMLElement;
        const generateButton = dialog.element.querySelector(".note-to-drawio__generate") as HTMLButtonElement;
        const regenerateButton = dialog.element.querySelector(".note-to-drawio__regenerate") as HTMLButtonElement;
        const insertButton = dialog.element.querySelector(".note-to-drawio__insert") as HTMLButtonElement;
        const cancelButton = dialog.element.querySelector(".note-to-drawio__cancel") as HTMLButtonElement;
        const scopeHeader = dialog.element.querySelector(".note-to-drawio__scope-header") as HTMLElement;
        const scopeBody = dialog.element.querySelector(".note-to-drawio__scope-body") as HTMLElement;
        const scopeSummary = dialog.element.querySelector(".note-to-drawio__scope-summary") as HTMLElement;
        const treeContainer = dialog.element.querySelector(".note-to-drawio__tree") as HTMLElement;
        const selectAllButton = dialog.element.querySelector(".note-to-drawio__select-all") as HTMLButtonElement;
        const clearButton = dialog.element.querySelector(".note-to-drawio__clear") as HTMLButtonElement;

        typeSelect.value = presetType ?? config.defaultType;
        positionSelect.value = config.defaultInsertPosition;

        let hasGenerated = false;
        const selectedIds = new Set<string>();
        const blockNodes = new Map<string, IBlockNode>();
        const checkboxes = new Map<string, HTMLInputElement>();
        let blockTree: IBlockNode[] = [];

        scopeHeader.addEventListener("click", () => {
            const collapsed = scopeBody.style.display === "none";
            scopeBody.style.display = collapsed ? "" : "none";
            scopeHeader.classList.toggle("note-to-drawio__scope-header--open", collapsed);
        });

        const updateSummary = () => {
            scopeSummary.textContent = selectedIds.size === 0 ?
                this.t("scopeWholeDoc") :
                this.t("scopeSelected").replace("${count}", String(selectedIds.size));
        };

        const setNodeChecked = (node: IBlockNode, checked: boolean) => {
            if (checked) {
                selectedIds.add(node.id);
            } else {
                selectedIds.delete(node.id);
            }
            const checkbox = checkboxes.get(node.id);
            if (checkbox) {
                checkbox.checked = checked;
            }
            node.children.forEach((child) => setNodeChecked(child, checked));
        };

        const renderNode = (node: IBlockNode, depth: number) => {
            const row = document.createElement("label");
            row.className = "note-to-drawio__tree-row";
            row.style.paddingLeft = `${depth * 16}px`;
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkboxes.set(node.id, checkbox);
            checkbox.addEventListener("change", () => {
                setNodeChecked(node, checkbox.checked);
                updateSummary();
            });
            const badge = document.createElement("span");
            badge.className = "note-to-drawio__badge";
            badge.textContent = this.blockBadge(node);
            row.append(checkbox, badge);
            const label = this.blockLabel(node);
            if (label) {
                const text = document.createElement("span");
                text.className = "note-to-drawio__tree-label";
                text.textContent = label;
                row.append(text);
            }
            treeContainer.append(row);
            node.children.forEach((child) => renderNode(child, depth + 1));
        };

        const loadBlockTree = async () => {
            try {
                blockTree = await this.fetchBlockTree(protyle.block.rootID);
                treeContainer.innerHTML = "";
                blockNodes.clear();
                checkboxes.clear();
                const index = (nodes: IBlockNode[]) => {
                    for (const node of nodes) {
                        blockNodes.set(node.id, node);
                        index(node.children);
                    }
                };
                index(blockTree);
                blockTree.forEach((node) => renderNode(node, 0));
            } catch (e) {
                treeContainer.innerHTML = "";
                const error = document.createElement("div");
                error.className = "note-to-drawio__tree-error";
                error.textContent = `${this.t("scopeLoadFailed")}: ${e instanceof Error ? e.message : e}`;
                treeContainer.append(error);
            }
        };
        loadBlockTree();

        selectAllButton.addEventListener("click", () => {
            blockTree.forEach((node) => setNodeChecked(node, true));
            updateSummary();
        });
        clearButton.addEventListener("click", () => {
            blockTree.forEach((node) => setNodeChecked(node, false));
            updateSummary();
        });

        const getTopMostSelected = (): IBlockNode[] => {
            const hasSelectedAncestor = (node: IBlockNode): boolean => {
                let parentID = node.parentID;
                while (parentID) {
                    if (selectedIds.has(parentID)) {
                        return true;
                    }
                    const parent = blockNodes.get(parentID);
                    if (!parent) {
                        return false;
                    }
                    parentID = parent.parentID;
                }
                return false;
            };
            const result: IBlockNode[] = [];
            const walk = (nodes: IBlockNode[]) => {
                for (const node of nodes) {
                    if (selectedIds.has(node.id) && !hasSelectedAncestor(node)) {
                        result.push(node);
                    }
                    walk(node.children);
                }
            };
            walk(blockTree);
            return result;
        };

        const syncTypeUI = () => {
            const isMermaid = typeSelect.value === "mermaid";
            subtypeField.style.display = isMermaid ? "" : "none";
            previewArea.readOnly = !isMermaid;
        };
        syncTypeUI();
        typeSelect.addEventListener("change", syncTypeUI);

        const setStatus = (text: string, state: "idle" | "working" | "success" | "error") => {
            statusElement.textContent = text;
            statusElement.className = `note-to-drawio__status note-to-drawio__status--${state}`;
        };
        const setButtons = (busy: boolean) => {
            generateButton.disabled = busy;
            regenerateButton.disabled = busy || !hasGenerated;
            insertButton.disabled = busy || !previewArea.value.trim();
        };
        const stageText: Record<TStage, string> = {
            reading: this.t("statusReading"),
            readingBlocks: this.t("statusReadingBlocks"),
            calling: this.t("statusCalling"),
        };

        const doGenerate = async () => {
            setButtons(true);
            const startTime = Date.now();
            try {
                const source = await this.generateSource(
                    typeSelect.value as TDiagramType,
                    subtypeSelect.value as TMermaidSubtype,
                    instructionsInput.value,
                    protyle,
                    getTopMostSelected(),
                    (stage) => setStatus(stageText[stage], "working"),
                );
                previewArea.value = source;
                hasGenerated = true;
                const seconds = ((Date.now() - startTime) / 1000).toFixed(1);
                setStatus(this.t("statusDone").replace("${seconds}", seconds), "success");
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                setStatus(this.t("statusFailed").replace("${error}", message), "error");
                showMessage(message, 6000, "error");
            } finally {
                setButtons(false);
            }
        };

        generateButton.addEventListener("click", doGenerate);
        regenerateButton.addEventListener("click", doGenerate);
        cancelButton.addEventListener("click", () => dialog.destroy());
        insertButton.addEventListener("click", async () => {
            setButtons(true);
            try {
                const type = typeSelect.value as TDiagramType;
                await this.insertDiagram(
                    type,
                    previewArea.value,
                    positionSelect.value as TInsertPosition,
                    protyle,
                );
                dialog.destroy();
                showMessage(type === "drawio" ? this.t("insertSuccess") : this.t("mermaidInsertSuccess"), 6000, "info");
            } catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                setStatus(this.t("statusFailed").replace("${error}", message), "error");
                showMessage(message, 6000, "error");
                setButtons(false);
            }
        });
        dialog.bindInput(instructionsInput, () => {
            if (!generateButton.disabled) {
                doGenerate();
            }
        });
    }

    private async fetchBlockTree(rootID: string): Promise<IBlockNode[]> {
        const res = await fetchSyncPost("/api/query/sql", {
            stmt: `SELECT id, parent_id, type, subtype, content FROM blocks WHERE root_id='${rootID}' ORDER BY sort`,
        });
        if (res.code !== 0) {
            throw new Error(res.msg);
        }
        const rows = (res.data || []) as {
            id: string, parent_id: string, type: string, subtype: string, content: string,
        }[];
        const nodes = new Map<string, IBlockNode>();
        for (const row of rows) {
            if (row.type === "d") {
                continue;
            }
            nodes.set(row.id, {
                id: row.id,
                parentID: row.parent_id,
                type: row.type,
                subtype: row.subtype,
                content: row.content || "",
                children: [],
            });
        }
        const roots: IBlockNode[] = [];
        for (const node of nodes.values()) {
            const parent = nodes.get(node.parentID);
            if (parent) {
                parent.children.push(node);
            } else {
                roots.push(node);
            }
        }
        return roots;
    }

    private blockBadge(node: IBlockNode): string {
        if (node.type === "h") {
            return node.subtype || "h";
        }
        const key = "blockType_" + node.type;
        const label = this.t(key);
        return label === key ? node.type : label;
    }

    private blockLabel(node: IBlockNode): string {
        const text = node.content
            .replace(/[*_~`\\#\[\]()!|>]/g, "")
            .replace(/\s+/g, " ")
            .trim();
        if (!text) {
            return "";
        }
        return text.length > MAX_BLOCK_LABEL_LENGTH ?
            text.slice(0, MAX_BLOCK_LABEL_LENGTH) + "…" :
            text;
    }

    private async collectSelectedContent(nodes: IBlockNode[]): Promise<string> {
        const ordered: IBlockNode[] = [];
        const walk = (node: IBlockNode) => {
            ordered.push(node);
            node.children.forEach(walk);
        };
        nodes.forEach(walk);
        const parts = await Promise.all(ordered.map(async (node) => {
            const res = await fetchSyncPost("/api/block/getBlockKramdown", {id: node.id});
            if (res.code !== 0) {
                throw new Error(`${this.t("fetchContentFailed")}: ${res.msg}`);
            }
            return ((res.data?.kramdown || "") as string).trim();
        }));
        return parts.filter((part) => part).join("\n\n");
    }

    private async generateSource(
        type: TDiagramType,
        subtype: TMermaidSubtype,
        instructions: string,
        protyle: IProtyle,
        selectedNodes: IBlockNode[],
        onStage?: (stage: TStage) => void,
    ): Promise<string> {
        const config = this.getConfig();
        if (!config.apiKey) {
            this.openSetting();
            throw new Error(this.t("missingApiKey"));
        }
        const rootID = protyle.block.rootID;
        if (!rootID) {
            throw new Error(this.t("noEditor"));
        }

        let content: string;
        if (selectedNodes.length > 0) {
            onStage?.("readingBlocks");
            content = await this.collectSelectedContent(selectedNodes);
        } else {
            onStage?.("reading");
            const mdRes = await fetchSyncPost("/api/export/exportMdContent", {id: rootID});
            if (mdRes.code !== 0) {
                throw new Error(`${this.t("fetchContentFailed")}: ${mdRes.msg}`);
            }
            content = (mdRes.data?.content || "") as string;
            const hPath = (mdRes.data?.hPath || "") as string;
            this.lastDocTitle = hPath.split("/").pop() || "flowchart";
        }
        if (!content.trim()) {
            throw new Error(this.t("docEmpty"));
        }
        if (content.length > MAX_CONTENT_LENGTH) {
            content = content.slice(0, MAX_CONTENT_LENGTH);
        }

        let systemPrompt = type === "drawio" ? DRAWIO_SYSTEM_PROMPT : MERMAID_SYSTEM_PROMPT;
        if (type === "mermaid" && subtype !== "auto") {
            systemPrompt += `\n\n注意：本次必须输出 ${subtype} 类型的图表，第一行必须是以 "${subtype}" 开头的类型声明，不要使用其他类型。`;
        }
        let userContent = "请根据以下笔记内容生成图表：\n\n" + content;
        if (instructions.trim()) {
            userContent += "\n\n补充要求：" + instructions.trim();
        }

        onStage?.("calling");
        const reply = await this.callLLM(config, systemPrompt, userContent);
        if (type === "drawio") {
            const xml = this.extractXML(reply);
            if (!xml) {
                throw new Error(this.t("xmlExtractFailed"));
            }
            if (!this.validateXML(xml)) {
                throw new Error(this.t("xmlInvalid"));
            }
            return xml;
        }
        const source = this.extractMermaid(reply);
        if (!source) {
            throw new Error(this.t("mermaidInvalid"));
        }
        return source;
    }

    private async insertDiagram(
        type: TDiagramType,
        source: string,
        position: TInsertPosition,
        protyle: IProtyle,
    ): Promise<void> {
        if (type === "drawio") {
            const xml = this.extractXML(source);
            if (!xml || !this.validateXML(xml)) {
                throw new Error(this.t("xmlInvalid"));
            }
            const blockID = this.newBlockID();
            const safeTitle = this.lastDocTitle.replace(/[\\/:*?"<>|$&^.]/g, "").trim() || "flowchart";
            const filename = `${safeTitle}-${blockID}.drawio`;
            const assetPath = `${DRAWIO_ASSET_DIR}/${filename}`;
            await this.saveDrawioFile(assetPath, filename, xml);
            const html = `<iframe frameborder="0" style="width:100%;height:480px;" src="/plugins/siyuan-drawio-plugin/webapp/?tags=%7B%7D&lightbox=1&highlight=0000ff&edit=_blank&layers=1&toolbar-config=%7B%22refreshBtn%22%3A%7B%7D&title=${filename}#U${encodeURIComponent(assetPath)}"></iframe>
{: id="${blockID}" custom-data-assets="${assetPath}" }`;
            if (position === "cursor") {
                protyle.getInstance().insert(html, true, true);
            } else {
                const res = await fetchSyncPost("/api/block/appendBlock", {
                    dataType: "markdown",
                    data: html,
                    parentID: protyle.block.rootID,
                });
                if (res.code !== 0) {
                    throw new Error(`${this.t("insertBlockFailed")}: ${res.msg}`);
                }
            }
            return;
        }

        const mermaidSource = this.extractMermaid(source);
        if (!mermaidSource) {
            throw new Error(this.t("mermaidInvalid"));
        }
        const params: {dataType: string, data: string, nextID: string, previousID: string, parentID: string} = {
            dataType: "markdown",
            data: "```mermaid\n" + mermaidSource + "\n```",
            nextID: "",
            previousID: "",
            parentID: "",
        };
        if (position === "cursor") {
            const cursorBlockID = this.getCursorBlockID(protyle);
            if (cursorBlockID) {
                params.previousID = cursorBlockID;
            } else {
                params.parentID = protyle.block.rootID;
            }
        } else {
            params.parentID = protyle.block.rootID;
        }
        const res = await fetchSyncPost("/api/block/insertBlock", params);
        if (res.code !== 0) {
            throw new Error(`${this.t("insertBlockFailed")}: ${res.msg}`);
        }
    }

    private getCursorBlockID(protyle: IProtyle): string | null {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }
        const node = selection.anchorNode;
        const element = node instanceof Element ? node : node?.parentElement;
        const blockElement = element?.closest("[data-node-id]");
        if (!blockElement || !protyle.element?.contains(blockElement)) {
            return null;
        }
        return blockElement.getAttribute("data-node-id");
    }

    private async callLLM(config: IDrawioAIConfig, systemPrompt: string, userContent: string): Promise<string> {
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
                        {role: "system", content: systemPrompt},
                        {role: "user", content: userContent},
                    ],
                },
                payloadEncoding: "json",
                responseEncoding: "text",
            });
        } catch (e) {
            throw new Error(`${this.t("llmRequestFailed")}: ${e}`);
        }
        if (res.code !== 0) {
            throw new Error(`${this.t("llmRequestFailed")}: ${res.msg}`);
        }
        let body: any = res.data?.body;
        if (typeof body === "string") {
            try {
                body = JSON.parse(body);
            } catch (e) {
                throw new Error(`${this.t("llmResponseInvalid")}: ${e}`);
            }
        }
        const text = body?.choices?.[0]?.message?.content;
        if (typeof text !== "string" || !text.trim()) {
            const detail = typeof body === "object" ? JSON.stringify(body).slice(0, 200) : String(body);
            throw new Error(`${this.t("llmResponseInvalid")}: ${detail}`);
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

    private extractMermaid(reply: string): string | null {
        const source = reply.split("\n")
            .filter((line) => !/^```/.test(line.trim()))
            .join("\n")
            .trim();
        if (!source) {
            return null;
        }
        const firstLine = source.split("\n").map((line) => line.trim()).find((line) => line.length > 0);
        if (!firstLine || !MERMAID_KEYWORD_PATTERN.test(firstLine)) {
            return null;
        }
        return source;
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

    private async saveDrawioFile(assetPath: string, filename: string, xml: string): Promise<void> {
        const formData = new FormData();
        formData.append("path", `/data/${assetPath}`);
        formData.append("isDir", "false");
        formData.append("modTime", String(Date.now()));
        formData.append("file", new File([xml], filename, {type: "text/xml"}));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await fetchSyncPost("/api/file/putFile", formData as any);
        if (res.code !== 0) {
            throw new Error(`${this.t("saveFileFailed")}: ${res.msg}`);
        }
    }
}
