"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserKeybindingsUri = getUserKeybindingsUri;
exports.readCurrentKeybindings = readCurrentKeybindings;
exports.calculateKeybindingsDiff = calculateKeybindingsDiff;
exports.syncSessionKeybindingsDiff = syncSessionKeybindingsDiff;
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
 * セッションに初期キーバインドスナップショットが存在する場合、現在の keybindings.json との差分を自動同期する
 * （ワークスペースへの勝手なファイル書き出しは行わず、メモリ/状態のみを更新）
 */
async function syncSessionKeybindingsDiff(store) {
    const initialKb = await store.getInitialKeybindings();
    if (!initialKb || initialKb.length === 0) {
        return undefined;
    }
    const currentKb = await readCurrentKeybindings();
    if (!currentKb || !currentKb.items) {
        return store.getSessionData().keybindingsDiff;
    }
    const diff = calculateKeybindingsDiff(initialKb, currentKb.items);
    await store.updateSessionState({ keybindingsDiff: diff });
    return diff;
}
//# sourceMappingURL=keybindingsService.js.map