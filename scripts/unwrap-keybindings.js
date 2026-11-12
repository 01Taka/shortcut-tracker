const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ----------------------------------------------------
// 設定
// ----------------------------------------------------

// 優先度の強さ定義（数値が大きいほど優先度が高い）
const PRIORITY_LEVELS = {
  new: 5,
  core: 4,
  primary: 3,
  secondary: 2,
  tertiary: 1,
};

// デフォルトの出力優先度（CLI引数で指定されない場合に使用）
// "new" | "primary" | "secondary" | "tertiary"
const DEFAULT_PRIORITY = "primary";

// 入力パス
const defaultInputPath = path.join(
  process.env.APPDATA || "C:\\Users\\user\\AppData\\Roaming",
  "Code",
  "User",
  "keybindings.json",
);
const fallbackInputPath = path.resolve(__dirname, "..", "shortcuts-log", "2026-10-18-v3.jsonc");
const inputPath = fs.existsSync(defaultInputPath)
  ? defaultInputPath
  : fallbackInputPath;

// ----------------------------------------------------
// 関数
// ----------------------------------------------------

/**
 * 実行時引数をパース
 */
function parseCliOptions() {
  const options = {
    priority: DEFAULT_PRIORITY,
    excludeRunCommands: false,
    noComments: false,
    isFull: false,
    mode: null,
    inputPath: null,
    outputPath: null,
  };

  for (const arg of process.argv.slice(2)) {
    const lower = arg.toLowerCase();
    if (lower === "--light") {
      // --light は --no-run-commands --no-comments --priority=primary と同義
      options.excludeRunCommands = true;
      options.noComments = true;
      options.priority = "primary";
      options.mode = "light";
    } else if (lower === "--full" || lower === "--all") {
      // --full は priority や runCommands に関わらずすべて出力
      options.isFull = true;
      options.excludeRunCommands = false;
      options.mode = "full";
    } else if (lower.startsWith("--priority=")) {
      const p = lower.slice("--priority=".length);
      if (PRIORITY_LEVELS[p]) {
        options.priority = p;
      }
    } else if (PRIORITY_LEVELS[lower]) {
      // 引数で直接優先度名が渡された場合 (後方互換性)
      options.priority = lower;
    } else if (
      lower === "--no-run-commands" ||
      lower === "--exclude-run-commands" ||
      lower === "--without-run-commands"
    ) {
      options.excludeRunCommands = true;
    } else if (
      lower === "--no-comments" ||
      lower === "--no-comment" ||
      lower === "--strip-comments" ||
      lower === "--without-comments"
    ) {
      options.noComments = true;
    } else if (lower.startsWith("--input=")) {
      const val = arg.slice(arg.indexOf("=") + 1);
      options.inputPath = path.resolve(val);
    } else if (lower.startsWith("--out=") || lower.startsWith("--output=")) {
      const val = arg.slice(arg.indexOf("=") + 1);
      options.outputPath = path.resolve(val);
    }
  }

  if (!options.inputPath) {
    options.inputPath = inputPath;
  }

  if (!options.outputPath) {
    let fileName = "keybindings.default.jsonc";
    if (options.mode === "light" || options.excludeRunCommands) {
      fileName = "keybindings.light.jsonc";
    } else if (options.isFull) {
      fileName = "keybindings.full.jsonc";
    }
    options.outputPath = path.join(__dirname, "output", fileName);
  }

  return options;
}

/**
 * JSオブジェクト記法を安全にパース
 */
function parseLooseObject(content) {
  const script = new vm.Script(`(${content})`);
  return script.runInNewContext({});
}

/**
 * args.keep === true (または item.keep === true) かどうかを判定
 */
function isKeptItem(item) {
  return item?.args?.keep === true || item?.keep === true;
}

/**
 * runCommands (または workbench.action.runCommands) かどうかを判定
 */
function isRunCommandsItem(item) {
  if (item?.command === "myTracker.trackAndRun" && item.args) {
    const cmd = item.args.command;
    return cmd === "runCommands" || cmd === "workbench.action.runCommands";
  }
  return (
    item?.command === "runCommands" ||
    item?.command === "workbench.action.runCommands"
  );
}

/**
 * 指定した優先度の閾値および各種フィルターに合致するか判定
 */
function shouldIncludeItem(
  item,
  { targetPriority, excludeRunCommands = false, isFull = false },
) {
  // --full の場合、priority や runCommands に関わらずすべて含める
  if (isFull) {
    return true;
  }

  // runCommands 除外オプション (keep: true が指定されている場合は除外しない)
  if (excludeRunCommands && !isKeptItem(item) && isRunCommandsItem(item)) {
    return false;
  }

  // myTracker.trackAndRun かつ priority が指定されている場合
  if (item?.command === "myTracker.trackAndRun" && item.args?.priority) {
    const itemPriority = String(item.args.priority).toLowerCase();
    const itemLevel = PRIORITY_LEVELS[itemPriority] ?? 0;
    const targetLevel = PRIORITY_LEVELS[targetPriority] ?? 0;

    // 指定された優先度より低い場合は除外
    return itemLevel >= targetLevel;
  }

  // myTracker 以外、または priority 指定がない通常のキーバインドは常に含める
  return true;
}

/**
 * 1つのキーバインドオブジェクトから myTracker をアンラップ
 */
function unwrapItem(item) {
  if (item.command === "myTracker.trackAndRun" && item.args) {
    const trackerArgs = item.args;
    const result = {
      key: item.key,
      command: trackerArgs.command,
    };
    if (trackerArgs.commandArgs !== undefined) {
      result.args = trackerArgs.commandArgs;
    }
    if (item.when !== undefined) {
      result.when = item.when;
    }
    return result;
  }

  // 通常アイテムで keep プロパティが存在する場合はクリーンアップ
  if (item && "keep" in item) {
    const { keep, ...rest } = item;
    return rest;
  }

  return item;
}

/**
 * ファイル全体を走査し、コメントを維持しながらオブジェクトを変換・フィルタリング
 */
function processKeybindingsFile(rawText, options) {
  const targetPriority = options.priority;
  const excludeRunCommands = options.excludeRunCommands;

  // BOM除去
  let text = rawText.charCodeAt(0) === 0xfeff ? rawText.slice(1) : rawText;

  let result = "";
  let i = 0;
  const len = text.length;

  const items = [];
  let totalItems = 0;
  let includedItems = 0;
  let excludedRunCommandsCount = 0;
  let excludedPriorityCount = 0;
  let keptRunCommandsCount = 0;

  while (i < len) {
    // 1行コメント (//#region, //#endregion, // ... など)
    if (text[i] === "/" && text[i + 1] === "/") {
      let start = i;
      while (i < len && text[i] !== "\n") {
        i++;
      }
      result += text.slice(start, i);
      continue;
    }

    // ブロックコメント (/* ... */)
    if (text[i] === "/" && text[i + 1] === "*") {
      let start = i;
      i += 2;
      while (i < len && !(text[i - 1] === "*" && text[i] === "/")) {
        i++;
      }
      i++;
      result += text.slice(start, i);
      continue;
    }

    // 設定ブロックの開始 '{'
    if (text[i] === "{") {
      let start = i;
      let depth = 0;
      let inString = null;

      // ネストしたカッコや文字列を考慮して対応する '}' を探す
      while (i < len) {
        const char = text[i];

        if (inString) {
          if (char === "\\") {
            i += 2; // エスケープ文字をスキップ
            continue;
          }
          if (char === inString) {
            inString = null;
          }
        } else {
          if (char === '"' || char === "'" || char === "`") {
            inString = char;
          } else if (char === "{") {
            depth++;
          } else if (char === "}") {
            depth--;
            if (depth === 0) {
              i++; // '}' を含める
              break;
            }
          }
        }
        i++;
      }

      const blockText = text.slice(start, i);
      try {
        const parsed = parseLooseObject(blockText);
        totalItems++;

        // フィルター判定
        const include = shouldIncludeItem(parsed, {
          targetPriority,
          excludeRunCommands,
          isFull: options.isFull,
        });

        if (!include) {
          if (excludeRunCommands && !isKeptItem(parsed) && isRunCommandsItem(parsed)) {
            excludedRunCommandsCount++;
          } else {
            excludedPriorityCount++;
          }

          // 除外対象の場合: 直前のインデント（空白）を取り消す
          let trimIdx = result.length;
          while (
            trimIdx > 0 &&
            (result[trimIdx - 1] === " " || result[trimIdx - 1] === "\t")
          ) {
            trimIdx--;
          }
          if (trimIdx === 0 || result[trimIdx - 1] === "\n") {
            result = result.slice(0, trimIdx);
          }

          // オブジェクト直後のカンマと改行をスキップ
          let lookAhead = i;
          while (
            lookAhead < len &&
            (text[lookAhead] === " " || text[lookAhead] === "\t")
          ) {
            lookAhead++;
          }
          if (lookAhead < len && text[lookAhead] === ",") {
            lookAhead++;
            if (lookAhead < len && text[lookAhead] === "\r") lookAhead++;
            if (lookAhead < len && text[lookAhead] === "\n") lookAhead++;
            i = lookAhead;
          }
          continue;
        }

        includedItems++;
        if (excludeRunCommands && isKeptItem(parsed) && isRunCommandsItem(parsed)) {
          keptRunCommandsCount++;
        }

        const unwrapped = unwrapItem(parsed);
        items.push(unwrapped);

        // インデント（2スペース）をつけて整形
        const formatted = JSON.stringify(unwrapped, null, 2)
          .split("\n")
          .map((line, idx) => (idx === 0 ? line : "  " + line))
          .join("\n");

        result += "  " + formatted;
      } catch {
        // パースできなかった場合は元のテキストを維持
        result += blockText;
      }
      continue;
    }

    // その他の文字（[、]、カンマ、改行、空白など）はそのまま追記
    result += text[i];
    i++;
  }

  const finalContent = options.noComments
    ? JSON.stringify(items, null, 2) + "\n"
    : result;

  return {
    content: finalContent,
    stats: {
      total: totalItems,
      included: includedItems,
      excludedRunCommands: excludedRunCommandsCount,
      excludedPriority: excludedPriorityCount,
      keptRunCommands: keptRunCommandsCount,
    },
  };
}

function run() {
  try {
    const options = parseCliOptions();
    if (options.isFull) {
      console.log(
        `Mode: Full (all keybindings included regardless of priority or runCommands)`,
      );
    } else {
      console.log(
        `Target priority threshold: "${options.priority}" (includes higher priorities)`,
      );
      if (options.excludeRunCommands) {
        console.log(`Mode: Lightweight (excluding runCommands except keep: true)`);
      }
    }
    if (options.noComments) {
      console.log(`Comments: excluded (pure JSON format)`);
    }
    console.log(`Reading from: ${options.inputPath}`);

    if (!fs.existsSync(options.inputPath)) {
      throw new Error(`File not found: ${options.inputPath}`);
    }

    const rawContent = fs.readFileSync(options.inputPath, "utf-8");
    const { content: outputContent, stats } = processKeybindingsFile(
      rawContent,
      options,
    );

    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, outputContent, "utf-8");
    console.log(`Successfully generated: ${options.outputPath}`);
    console.log(
      `Keybinding stats: ${stats.included} included / ${stats.total} total` +
        (stats.excludedRunCommands > 0
          ? ` (${stats.excludedRunCommands} runCommands excluded)`
          : "") +
        (stats.keptRunCommands > 0
          ? ` (${stats.keptRunCommands} runCommands protected via keep: true)`
          : "") +
        (stats.excludedPriority > 0
          ? ` (${stats.excludedPriority} priority-filtered)`
          : ""),
    );
  } catch (error) {
    console.error("Failed to process keybindings:", error);
    process.exitCode = 1;
  }
}

run();
