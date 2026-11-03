import * as path from "path";
import * as vscode from "vscode";
import type { StatsStore } from "../store/statsStore";
import type { KeybindingDiffEntry, KeybindingsDiffResult } from "../types";
import { parseJsonc } from "../utils/jsonc";

/**
 * OSに応じたユーザーキーバインド設定（keybindings.json）のパスを取得
 */
export function getUserKeybindingsUri(): vscode.Uri | undefined {
  const appName = vscode.env.appName.toLowerCase();
  let folderName = "Code";
  if (appName.includes("insiders")) {
    folderName = "Code - Insiders";
  } else if (appName.includes("vscodium") || appName.includes("codium")) {
    folderName = "VSCodium";
  }

  let userDir: string | undefined;
  if (process.platform === "win32") {
    const appData =
      process.env.APPDATA ||
      (process.env.USERPROFILE
        ? path.join(process.env.USERPROFILE, "AppData", "Roaming")
        : undefined);
    if (appData) {
      userDir = path.join(appData, folderName, "User");
    }
  } else if (process.platform === "darwin") {
    const home = process.env.HOME;
    if (home) {
      userDir = path.join(
        home,
        "Library",
        "Application Support",
        folderName,
        "User",
      );
    }
  } else {
    const configHome =
      process.env.XDG_CONFIG_HOME ||
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
export async function readCurrentKeybindings(): Promise<
  { uri: vscode.Uri; items: any[]; rawText: string } | undefined
> {
  const uri = getUserKeybindingsUri();
  if (!uri) {
    return undefined;
  }
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const rawText = new TextDecoder("utf-8").decode(bytes);
    const items = parseJsonc<any[]>(rawText);
    if (Array.isArray(items)) {
      return { uri, items, rawText };
    }
  } catch (error) {
    console.error("Failed to read user keybindings.json", error);
  }
  return undefined;
}

function normalizeKey(item: any): string {
  if (!item || typeof item !== "object") {
    return "";
  }
  return String(item.key || "").toLowerCase().trim();
}

function getExactSignature(item: any): string {
  if (!item || typeof item !== "object") {
    return "";
  }
  const key = normalizeKey(item);
  const command = String(item.command || "").trim();
  const when = String(item.when || "").trim();
  const argsStr = item.args !== undefined ? JSON.stringify(item.args) : "";
  return `${key}|#|${command}|#|${when}|#|${argsStr}`;
}

interface IndexQueue {
  indices: number[];
  ptr: number;
}

/**
 * 開始時と終了時のキーバインド配列の差分を O(N) で計算
 */
export function calculateKeybindingsDiff(
  initialItems: any[],
  currentItems: any[],
): KeybindingsDiffResult {
  const initialLen = initialItems.length;
  const currentLen = currentItems.length;

  const sigBuckets = new Map<string, IndexQueue>();
  for (let iIdx = 0; iIdx < initialLen; iIdx++) {
    const sig = getExactSignature(initialItems[iIdx]);
    let bucket = sigBuckets.get(sig);
    if (!bucket) {
      bucket = { indices: [iIdx], ptr: 0 };
      sigBuckets.set(sig, bucket);
    } else {
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

  const keyBuckets = new Map<string, IndexQueue>();
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
    } else {
      bucket.indices.push(iIdx);
    }
  }

  const diffs: KeybindingDiffEntry[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;

  const addedIndices: number[] = [];
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
    } else {
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
export async function syncSessionKeybindingsDiff(
  store: StatsStore,
): Promise<KeybindingsDiffResult | undefined> {
  const initialKb = await store.getInitialKeybindings();
  if (!initialKb || initialKb.length === 0) {
    return undefined;
  }

  const currentKb = await readCurrentKeybindings();
  if (!currentKb || !currentKb.items) {
    return store.getSessionData().keybindingsDiff;
  }

  const diff = calculateKeybindingsDiff(initialKb, currentKb.items);
  const sessionData = store.getSessionData();
  sessionData.keybindingsDiff = diff;
  await store.saveSessionData(sessionData);
  return diff;
}
