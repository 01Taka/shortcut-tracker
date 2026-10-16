const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ----------------------------------------------------
// 設定
// ----------------------------------------------------

// 優先度の強さ定義（数値が大きいほど優先度が高い）
const PRIORITY_LEVELS = {
  new: 4,
  primary: 3,
  secondary: 2,
  tertiary: 1,
};

// デフォルトの出力優先度（CLI引数で指定されない場合に使用）
// "new" | "primary" | "secondary" | "tertiary"
const DEFAULT_PRIORITY = "primary";

// 入力パス
const inputPath = path.join(
  process.env.APPDATA || "C:\\Users\\user\\AppData\\Roaming",
  "Code",
  "User",
  "keybindings.json",
);

// 出力パス
const outputPath = path.join(process.cwd(), "keybindings.default.jsonc");

// ----------------------------------------------------
// 関数
// ----------------------------------------------------

/**
 * 実行時引数またはデフォルト設定からターゲットの優先度を取得
 */
function getSelectedPriority() {
  const arg = process.argv[2]?.replace(/^--priority=/, "").toLowerCase();
  if (arg && PRIORITY_LEVELS[arg]) {
    return arg;
  }
  return DEFAULT_PRIORITY;
}

/**
 * JSオブジェクト記法を安全にパース
 */
function parseLooseObject(content) {
  const script = new vm.Script(`(${content})`);
  return script.runInNewContext({});
}

/**
 * 指定した優先度の閾値に合致するか判定
 */
function shouldIncludeItem(item, targetPriority) {
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
  return item;
}

/**
 * ファイル全体を走査し、コメントを維持しながらオブジェクトを変換・フィルタリング
 */
function processKeybindingsFile(rawText, targetPriority) {
  // BOM除去
  let text = rawText.charCodeAt(0) === 0xfeff ? rawText.slice(1) : rawText;

  let result = "";
  let i = 0;
  const len = text.length;

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

        // 優先度フィルターの判定
        if (!shouldIncludeItem(parsed, targetPriority)) {
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

        const unwrapped = unwrapItem(parsed);

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

  return result;
}

function run() {
  try {
    const targetPriority = getSelectedPriority();
    console.log(
      `Target priority threshold: "${targetPriority}" (includes higher priorities)`,
    );
    console.log(`Reading from: ${inputPath}`);

    if (!fs.existsSync(inputPath)) {
      throw new Error(`File not found: ${inputPath}`);
    }

    const rawContent = fs.readFileSync(inputPath, "utf-8");
    const outputContent = processKeybindingsFile(rawContent, targetPriority);

    fs.writeFileSync(outputPath, outputContent, "utf-8");
    console.log(`Successfully generated: ${outputPath}`);
  } catch (error) {
    console.error("Failed to process keybindings:", error);
  }
}

run();
