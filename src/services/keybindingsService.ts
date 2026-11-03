import * as path from "path";
import * as vscode from "vscode";
import type {
  KeybindingDiffEntry,
  KeybindingsDiffResult,
  SessionData,
} from "../types";
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
    // Linux
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

  // 1. 完全一致照合用のシグネチャインデックスを O(N) で構築
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

  // 2. 未一致の initial 要素から正規化キーごとのインデックスを O(N) で構築
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

  // 3. modified（同じキーを持つ変更）を先に照合し、未一致の current 要素を記録
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
export async function saveDiffToFile(
  diff: KeybindingsDiffResult,
  sessionData: SessionData,
): Promise<vscode.Uri | undefined> {
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
  } catch {
    targetDir = root;
  }

  const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileUri = vscode.Uri.joinPath(
    targetDir,
    `session-diff-${dateStr}.json`,
  );

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
