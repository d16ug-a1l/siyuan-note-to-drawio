const fs = require("fs");
const path = require("path");

const pluginName = require("../plugin.json").name;

const workspace = process.env.SIYUAN_WORKSPACE || "/path/to/workspace";
const targetDir = path.join(workspace, "data", "plugins", pluginName);
const rootDir = path.join(__dirname, "..");

const entries = ["index.js", "index.css", "plugin.json", "i18n"];

fs.mkdirSync(targetDir, {recursive: true});

for (const entry of entries) {
    const target = path.join(targetDir, entry);
    if (fs.existsSync(target)) {
        fs.rmSync(target, {recursive: true, force: true});
    }
}

for (const file of fs.readdirSync(rootDir)) {
    if (/^README.*\.md$/.test(file)) {
        entries.push(file);
    }
}

let copied = 0;
for (const entry of entries) {
    const source = path.join(rootDir, entry);
    if (!fs.existsSync(source)) {
        console.warn(`[deploy] skip missing entry: ${entry}`);
        continue;
    }
    fs.cpSync(source, path.join(targetDir, entry), {recursive: true});
    copied++;
    console.log(`[deploy] copied ${entry}`);
}

console.log(`[deploy] done, ${copied} entries -> ${targetDir}`);
