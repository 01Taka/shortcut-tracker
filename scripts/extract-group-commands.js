const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ----------------------------------------------------
// 設定
// ----------------------------------------------------

// デフォルトの入力パス (unwrap-keybindings.js と同じ方法)
const DEFAULT_INPUT_PATH = path.join(
  process.env.APPDATA || "C:\\Users\\user\\AppData\\Roaming",
  "Code",
  "User",
  "keybindings.json"
);

// フォールバック用の最新ログファイル
const FALLBACK_INPUT_PATH = path.resolve(
  __dirname,
  "..",
  "shortcuts-log",
  "2026-10-18-v3.jsonc"
);

// デフォルトの出力パス
const DEFAULT_OUTPUT_PATH = path.join(
  __dirname,
  "output",
  "group-commands.json"
);

// ----------------------------------------------------
// ヘルパー関数
// ----------------------------------------------------

/**
 * コマンドライン引数をパース
 */
function parseArgs() {
  const args = {
    input: null,
    output: DEFAULT_OUTPUT_PATH,
    keepDuplicates: false,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--input=")) {
      args.input = path.resolve(arg.slice("--input=".length));
    } else if (arg.startsWith("--out=") || arg.startsWith("--output=")) {
      const val = arg.startsWith("--out=")
        ? arg.slice("--out=".length)
        : arg.slice("--output=".length);
      args.output = path.resolve(val);
    } else if (arg === "--keep-duplicates") {
      args.keepDuplicates = true;
    }
  }

  return args;
}

/**
 * 入力ファイルパスを解決
 */
function resolveInputPath(cliInput) {
  if (cliInput) {
    if (!fs.existsSync(cliInput)) {
      throw new Error(`指定された入力ファイルが見つかりません: ${cliInput}`);
    }
    return cliInput;
  }

  if (fs.existsSync(DEFAULT_INPUT_PATH)) {
    return DEFAULT_INPUT_PATH;
  }

  if (fs.existsSync(FALLBACK_INPUT_PATH)) {
    console.warn(
      `[WARN] デフォルトの keybindings.json が見つからないため、最新のログファイルを使用します: ${FALLBACK_INPUT_PATH}`
    );
    return FALLBACK_INPUT_PATH;
  }

  throw new Error(
    `入力ファイルが見つかりません:\n  - ${DEFAULT_INPUT_PATH}\n  - ${FALLBACK_INPUT_PATH}`
  );
}

/**
 * JSON / JSONC / JS オブジェクト配列をパース
 */
function parseLooseJsonc(content) {
  // BOM除去
  const clean = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const script = new vm.Script(`(${clean})`);
  return script.runInNewContext({});
}

/**
 * 1つのキーバインド定義からコマンドを抽出
 * - 複数コマンド (runCommands 等) の場合はコマンド名の配列
 * - 単一コマンドの場合は文字列
 */
function extractCommand(item) {
  // myTracker.trackAndRun でラップされている場合
  if (item?.command === "myTracker.trackAndRun" && item.args) {
    const trackerArgs = item.args;
    const targetCommand = trackerArgs.command;

    if (
      targetCommand === "runCommands" ||
      targetCommand === "workbench.action.runCommands"
    ) {
      const cArgs = trackerArgs.commandArgs;
      if (Array.isArray(cArgs?.commands)) {
        return cArgs.commands
          .map((c) => (typeof c === "string" ? c : c?.command))
          .filter(Boolean);
      }
    }

    return targetCommand;
  }

  // 通常のキーバインド定義の場合
  const topCommand = item?.command;
  if (
    topCommand === "runCommands" ||
    topCommand === "workbench.action.runCommands"
  ) {
    const cArgs = item.args;
    if (Array.isArray(cArgs?.commands)) {
      return cArgs.commands
        .map((c) => (typeof c === "string" ? c : c?.command))
        .filter(Boolean);
    }
  }

  return topCommand;
}

/**
 * キーバインド一覧からグループIDをキーにしたマップを生成
 */
function buildGroupCommandsMap(keybindings, { keepDuplicates = false } = {}) {
  const result = {};

  for (const item of keybindings) {
    // グループIDの取得 (item.args.group または item.group)
    const group = item?.args?.group || item?.group;
    if (!group) {
      continue;
    }

    const command = extractCommand(item);
    if (!command || (Array.isArray(command) && command.length === 0)) {
      continue;
    }

    if (!result[group]) {
      result[group] = [];
    }

    if (keepDuplicates) {
      result[group].push(command);
    } else {
      // 重複チェック (文字列または配列の構造比較)
      const key = JSON.stringify(command);
      const alreadyExists = result[group].some(
        (existing) => JSON.stringify(existing) === key
      );
      if (!alreadyExists) {
        result[group].push(command);
      }
    }
  }

  return result;
}

// ----------------------------------------------------
// メイン処理
// ----------------------------------------------------

function run() {
  try {
    const { input, output, keepDuplicates } = parseArgs();
    const inputPath = resolveInputPath(input);

    console.log(`Reading from: ${inputPath}`);
    const rawContent = fs.readFileSync(inputPath, "utf-8");
    const keybindings = parseLooseJsonc(rawContent);

    if (!Array.isArray(keybindings)) {
      throw new Error("入力ファイルの内容が配列ではありません。");
    }

    const groupMap = buildGroupCommandsMap(keybindings, { keepDuplicates });
    const groupCount = Object.keys(groupMap).length;
    let totalCommands = 0;

    for (const cmds of Object.values(groupMap)) {
      totalCommands += cmds.length;
    }

    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(groupMap, null, 2), "utf-8");

    console.log(`Successfully generated: ${output}`);
    console.log(`Total groups: ${groupCount}`);
    console.log(`Total command entries: ${totalCommands}`);
    console.log(`Duplicates mode: ${keepDuplicates ? "kept" : "deduplicated"}`);
  } catch (error) {
    console.error("Failed to generate group commands JSON:", error);
    process.exitCode = 1;
  }
}

run();
