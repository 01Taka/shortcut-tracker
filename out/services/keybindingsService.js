"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserKeybindingsUri = getUserKeybindingsUri;
exports.readCurrentKeybindings = readCurrentKeybindings;
exports.calculateKeybindingsDiff = calculateKeybindingsDiff;
exports.saveDiffToFile = saveDiffToFile;
const path = require("path");
const vscode = require("vscode");
const jsonc_1 = require("../utils/jsonc");
/**
 * OSに応じたユーザーキーバインド設定（keybindings.json）のパスを取得
 */
function getUserKeybindingsUri() {
    const appName = vscode.env.appName.toLowerCase();
    let folderName = "Code";
    if (appName.includes("insiders")) {
        folderName = "Code - Insiders";
    }
    else if (appName.includes("vscodium") || appName.includes("codium")) {
        folderName = "VSCodium";
    }
    let userDir;
    if (process.platform === "win32") {
        const appData = process.env.APPDATA ||
            (process.env.USERPROFILE
                ? path.join(process.env.USERPROFILE, "AppData", "Roaming")
                : undefined);
        if (appData) {
            userDir = path.join(appData, folderName, "User");
        }
    }
    else if (process.platform === "darwin") {
        const home = process.env.HOME;
        if (home) {
            userDir = path.join(home, "Library", "Application Support", folderName, "User");
        }
    }
    else {
        // Linux
        const configHome = process.env.XDG_CONFIG_HOME ||
            (process.env.HOME ? path.join(process.env.HOME, ".config") : undefined);
        if (configHome) {
            userDir = path.join(configHome, folderName, "User");
        }
    }
    if (userDir) {
        return vscode.Uri.file(path.join(userDir, "keybindings.json"));
    }
    return undefined;
}
/**
 * 現在のユーザーキーバインド設定ファイルを読み込んでパース
 */
async function readCurrentKeybindings() {
    const uri = getUserKeybindingsUri();
    if (!uri) {
        return undefined;
    }
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const rawText = new TextDecoder("utf-8").decode(bytes);
        const items = (0, jsonc_1.parseJsonc)(rawText);
        if (Array.isArray(items)) {
            return { uri, items, rawText };
        }
    }
    catch (error) {
        console.error("Failed to read user keybindings.json", error);
    }
    return undefined;
}
function normalizeKey(item) {
    if (!item || typeof item !== "object") {
        return "";
    }
    return String(item.key || "").toLowerCase().trim();
}
function getExactSignature(item) {
    if (!item || typeof item !== "object") {
        return "";
    }
    const key = normalizeKey(item);
    const command = String(item.command || "").trim();
    const when = String(item.when || "").trim();
    const argsStr = item.args !== undefined ? JSON.stringify(item.args) : "";
    return `${key}|#|${command}|#|${when}|#|${argsStr}`;
}
/**
 * 開始時と終了時のキーバインド配列の差分を O(N) で計算
 */
function calculateKeybindingsDiff(initialItems, currentItems) {
    const initialLen = initialItems.length;
    const currentLen = currentItems.length;
    // 1. 完全一致照合用のシグネチャインデックスを O(N) で構築
    const sigBuckets = new Map();
    for (let iIdx = 0; iIdx < initialLen; iIdx++) {
        const sig = getExactSignature(initialItems[iIdx]);
        let bucket = sigBuckets.get(sig);
        if (!bucket) {
            bucket = { indices: [iIdx], ptr: 0 };
            sigBuckets.set(sig, bucket);
        }
        else {
            bucket.indices.push(iIdx);
        }
    }
    const matchedInitial = new Uint8Array(initialLen);
    const matchedCurrent = new Uint8Array(currentLen);
    for (let cIdx = 0; cIdx < currentLen; cIdx++) {
        const sig = getExactSignature(currentItems[cIdx]);
        const bucket = sigBuckets.get(sig);
        if (bucket && bucket.ptr < bucket.indices.length) {
            const iIdx = bucket.indices[bucket.ptr++];
            matchedCurrent[cIdx] = 1;
            matchedInitial[iIdx] = 1;
        }
    }
    // 2. 未一致の initial 要素から正規化キーごとのインデックスを O(N) で構築
    const keyBuckets = new Map();
    for (let iIdx = 0; iIdx < initialLen; iIdx++) {
        if (matchedInitial[iIdx]) {
            continue;
        }
        const iKey = normalizeKey(initialItems[iIdx]);
        if (!iKey) {
            continue;
        }
        let bucket = keyBuckets.get(iKey);
        if (!bucket) {
            bucket = { indices: [iIdx], ptr: 0 };
            keyBuckets.set(iKey, bucket);
        }
        else {
            bucket.indices.push(iIdx);
        }
    }
    const diffs = [];
    let addedCount = 0;
    let removedCount = 0;
    let modifiedCount = 0;
    // 3. modified（同じキーを持つ変更）を先に照合し、未一致の current 要素を記録
    const addedIndices = [];
    for (let cIdx = 0; cIdx < currentLen; cIdx++) {
        if (matchedCurrent[cIdx]) {
            continue;
        }
        const cItem = currentItems[cIdx];
        const cKey = normalizeKey(cItem);
        const bucket = cKey ? keyBuckets.get(cKey) : undefined;
        if (bucket && bucket.ptr < bucket.indices.length) {
            const iIdx = bucket.indices[bucket.ptr++];
            matchedInitial[iIdx] = 1;
            const iItem = initialItems[iIdx];
            modifiedCount++;
            diffs.push({
                type: "modified",
                key: cItem.key,
                command: cItem.command,
                when: cItem.when,
                args: cItem.args,
                before: {
                    command: iItem.command,
                    when: iItem.when,
                    args: iItem.args,
                },
            });
        }
        else {
            addedIndices.push(cIdx);
        }
    }
    // 4. 残りの unmatchedCurrent は added
    for (let k = 0; k < addedIndices.length; k++) {
        const cItem = currentItems[addedIndices[k]];
        addedCount++;
        diffs.push({
            type: "added",
            key: cItem.key,
            command: cItem.command,
            when: cItem.when,
            args: cItem.args,
        });
    }
    // 5. 残りの unmatchedInitial は removed
    for (let iIdx = 0; iIdx < initialLen; iIdx++) {
        if (!matchedInitial[iIdx]) {
            const iItem = initialItems[iIdx];
            removedCount++;
            diffs.push({
                type: "removed",
                key: iItem.key,
                command: iItem.command,
                when: iItem.when,
                args: iItem.args,
            });
        }
    }
    return {
        calculatedAt: new Date().toISOString(),
        initialCount: initialLen,
        currentCount: currentLen,
        addedCount,
        removedCount,
        modifiedCount,
        diffs,
    };
}
/**
 * 差分結果をワークスペース内の shortcuts-log ディレクトリなどにJSONファイルとして保存
 */
async function saveDiffToFile(diff, sessionData) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return undefined;
    }
    const root = folders[0].uri;
    const shortcutsLogDir = vscode.Uri.joinPath(root, "shortcuts-log");
    let targetDir = root;
    try {
        await vscode.workspace.fs.stat(shortcutsLogDir);
        targetDir = shortcutsLogDir;
    }
    catch {
        targetDir = root;
    }
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fileUri = vscode.Uri.joinPath(targetDir, `session-diff-${dateStr}.json`);
    const payload = {
        version: 2,
        type: "sessionKeybindingsDiff",
        calculatedAt: diff.calculatedAt,
        session: {
            startedAt: sessionData.startedAt,
            stoppedAt: sessionData.stoppedAt,
            durationMs: sessionData.accumulatedMs,
        },
        summary: {
            initialKeybindingsCount: diff.initialCount,
            currentKeybindingsCount: diff.currentCount,
            addedCount: diff.addedCount,
            removedCount: diff.removedCount,
            modifiedCount: diff.modifiedCount,
            totalChanges: diff.diffs.length,
        },
        diffs: diff.diffs,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2));
    await vscode.workspace.fs.writeFile(fileUri, bytes);
    return fileUri;
}
//# sourceMappingURL=keybindingsService.js.map