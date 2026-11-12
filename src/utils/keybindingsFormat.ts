import { parseJsonc } from "./jsonc";

export interface TextReplacement {
  start: number;
  end: number;
  newText: string;
}

export interface FormatKeybindingsOptions {
  indentUnit?: string;
}

interface ValueSpan {
  start: number;
  end: number;
}

function skipTrivia(text: string, pos: number): number {
  const len = text.length;
  while (pos < len) {
    const ch = text.charCodeAt(pos);
    // whitespace: space, tab, lf, cr
    if (ch === 32 || ch === 9 || ch === 10 || ch === 13) {
      pos++;
      continue;
    }
    // '/'
    if (ch === 47 && pos + 1 < len) {
      const next = text.charCodeAt(pos + 1);
      if (next === 47) {
        pos += 2;
        while (pos < len && text.charCodeAt(pos) !== 10) {
          pos++;
        }
        continue;
      }
      if (next === 42) {
        pos += 2;
        while (pos < len) {
          if (
            text.charCodeAt(pos) === 42 &&
            text.charCodeAt(pos + 1) === 47
          ) {
            pos += 2;
            break;
          }
          pos++;
        }
        continue;
      }
    }
    break;
  }
  return pos;
}

function skipString(text: string, pos: number): number {
  const quote = text.charCodeAt(pos);
  const len = text.length;
  pos++;
  while (pos < len) {
    const ch = text.charCodeAt(pos);
    if (ch === 92) {
      pos += 2;
      continue;
    }
    pos++;
    if (ch === quote) {
      break;
    }
  }
  return pos;
}

function skipValue(text: string, pos: number): number {
  const len = text.length;
  if (pos >= len) {
    return pos;
  }
  const ch = text.charCodeAt(pos);
  if (ch === 34 || ch === 39) {
    return skipString(text, pos);
  }
  if (ch === 123 || ch === 91) {
    // '{' or '['
    let depth = 1;
    pos++;
    while (pos < len && depth > 0) {
      const c = text.charCodeAt(pos);
      if (c === 34 || c === 39) {
        pos = skipString(text, pos);
        continue;
      }
      if (c === 47 && pos + 1 < len) {
        const next = text.charCodeAt(pos + 1);
        if (next === 47) {
          pos += 2;
          while (pos < len && text.charCodeAt(pos) !== 10) {
            pos++;
          }
          continue;
        }
        if (next === 42) {
          pos += 2;
          while (pos < len) {
            if (
              text.charCodeAt(pos) === 42 &&
              text.charCodeAt(pos + 1) === 47
            ) {
              pos += 2;
              break;
            }
            pos++;
          }
          continue;
        }
      }
      if (c === 123 || c === 91) {
        depth++;
      } else if (c === 125 || c === 93) {
        depth--;
      }
      pos++;
    }
    return pos;
  }

  // primitive: number, boolean, null
  while (pos < len) {
    const c = text.charCodeAt(pos);
    if (
      c === 44 || // ','
      c === 125 || // '}'
      c === 93 || // ']'
      c === 32 ||
      c === 9 ||
      c === 10 ||
      c === 13 ||
      c === 47
    ) {
      break;
    }
    pos++;
  }
  return pos;
}

function getLineIndentAt(text: string, offset: number): string {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  let pos = lineStart;
  while (pos < offset) {
    const ch = text.charCodeAt(pos);
    if (ch !== 32 && ch !== 9) {
      break;
    }
    pos++;
  }
  return text.slice(lineStart, pos);
}

function isCommandsOnlyArgs(
  commandArgs: unknown,
): commandArgs is { commands: unknown[] } {
  if (!commandArgs || typeof commandArgs !== "object" || Array.isArray(commandArgs)) {
    return false;
  }
  const keys = Object.keys(commandArgs);
  return (
    keys.length === 1 &&
    keys[0] === "commands" &&
    Array.isArray((commandArgs as Record<string, unknown>).commands)
  );
}

/**
 * `myTracker.trackAndRun` の `args` オブジェクトをルールに従って正規化する。
 */
export function normalizeTrackArgs(
  rawArgs: Record<string, unknown>,
  rootKey?: string,
): Record<string, unknown> {
  let commandValue: unknown = rawArgs.command;
  let commandArgsValue: unknown = rawArgs.commandArgs;

  if (commandValue === "runCommands" && isCommandsOnlyArgs(commandArgsValue)) {
    commandValue = commandArgsValue.commands;
    commandArgsValue = undefined;
  }

  const effectiveCommandName = Array.isArray(commandValue)
    ? "runCommands"
    : typeof commandValue === "string"
      ? commandValue
      : undefined;

  let keyName =
    typeof rawArgs.keyName === "string" ? rawArgs.keyName : undefined;
  let nameSuffix =
    typeof rawArgs.nameSuffix === "string" && rawArgs.nameSuffix !== ""
      ? rawArgs.nameSuffix
      : undefined;

  if (keyName !== undefined) {
    // 末尾の " (key)" を削除
    const withoutParenKey = keyName.replace(/\s*\([^()]*\)$/, "").trimEnd();
    const colonIdx = withoutParenKey.indexOf(":");
    if (colonIdx !== -1) {
      const splitKeyName = withoutParenKey.slice(0, colonIdx);
      const splitSuffix = withoutParenKey.slice(colonIdx + 1);
      keyName = splitKeyName;
      if (nameSuffix === undefined && splitSuffix !== "") {
        nameSuffix = splitSuffix;
      }
    } else {
      keyName = withoutParenKey;
    }

    if (
      keyName === "" ||
      (effectiveCommandName !== undefined && keyName === effectiveCommandName)
    ) {
      keyName = undefined;
    }
  }

  const resolvedKey =
    typeof rootKey === "string" && rootKey !== ""
      ? rootKey
      : typeof rawArgs.key === "string" && rawArgs.key !== ""
        ? rawArgs.key
        : undefined;

  const ordered: Record<string, unknown> = {};
  if (resolvedKey !== undefined) {
    ordered.key = resolvedKey;
  }
  if (keyName !== undefined) {
    ordered.keyName = keyName;
  }
  if (nameSuffix !== undefined) {
    ordered.nameSuffix = nameSuffix;
  }
  if (commandValue !== undefined) {
    ordered.command = commandValue;
  }
  if (commandArgsValue !== undefined) {
    ordered.commandArgs = commandArgsValue;
  }

  const handledKeys = new Set([
    "key",
    "keyName",
    "nameSuffix",
    "command",
    "commandArgs",
  ]);
  for (const [k, v] of Object.entries(rawArgs)) {
    if (!handledKeys.has(k) && v !== undefined) {
      ordered[k] = v;
    }
  }

  return ordered;
}

function serializeObjectWithIndent(
  obj: Record<string, unknown>,
  baseIndent: string,
  indentUnit: string,
): string {
  const json = JSON.stringify(obj, null, indentUnit);
  return json.replace(/\n/g, `\n${baseIndent}`);
}

function extractObjectProperties(
  text: string,
  objStart: number,
): { end: number; props: Map<string, ValueSpan> } {
  const props = new Map<string, ValueSpan>();
  const len = text.length;
  let pos = objStart + 1; // skip '{'

  while (pos < len) {
    pos = skipTrivia(text, pos);
    if (pos >= len) {
      break;
    }
    const ch = text.charCodeAt(pos);
    if (ch === 125) {
      // '}'
      return { end: pos + 1, props };
    }
    if (ch === 44) {
      // ','
      pos++;
      continue;
    }
    if (ch !== 34 && ch !== 39) {
      pos++;
      continue;
    }

    const keyEnd = skipString(text, pos);
    const keyToken = text.slice(pos, keyEnd);
    let propName: string;
    try {
      propName = parseJsonc<string>(keyToken);
    } catch {
      propName = keyToken.slice(1, -1);
    }

    pos = skipTrivia(text, keyEnd);
    if (text.charCodeAt(pos) !== 58) {
      // ':'
      continue;
    }
    pos = skipTrivia(text, pos + 1);
    const valStart = pos;
    const valEnd = skipValue(text, valStart);
    props.set(propName, { start: valStart, end: valEnd });
    pos = valEnd;
  }

  return { end: pos, props };
}

/**
 * JSONC文字列を検証し、コメントや既存レイアウトを保持したまま
 * `myTracker.trackAndRun` エントリの `args` 置換箇所を計算する。
 */
export function computeKeybindingsFormatReplacements(
  text: string,
  options: FormatKeybindingsOptions = {},
): TextReplacement[] {
  const parsed = parseJsonc<unknown>(text);
  if (!Array.isArray(parsed)) {
    throw new Error("Top-level JSON value must be an array.");
  }

  const indentUnit = options.indentUnit ?? "  ";
  const replacements: TextReplacement[] = [];
  const len = text.length;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  pos = skipTrivia(text, pos);

  if (text.charCodeAt(pos) !== 91) {
    // '['
    throw new Error("Top-level JSON value must be an array.");
  }
  pos++;

  while (pos < len) {
    pos = skipTrivia(text, pos);
    if (pos >= len) {
      break;
    }
    const ch = text.charCodeAt(pos);
    if (ch === 93) {
      // ']'
      break;
    }
    if (ch === 44) {
      // ','
      pos++;
      continue;
    }
    if (ch !== 123) {
      // not '{'
      pos = skipValue(text, pos);
      continue;
    }

    const { end, props } = extractObjectProperties(text, pos);
    pos = end;

    const commandSpan = props.get("command");
    const argsSpan = props.get("args");
    if (!commandSpan || !argsSpan) {
      continue;
    }

    const commandVal = parseJsonc<unknown>(
      text.slice(commandSpan.start, commandSpan.end),
    );
    if (commandVal !== "myTracker.trackAndRun") {
      continue;
    }

    const rawArgsText = text.slice(argsSpan.start, argsSpan.end);
    const argsVal = parseJsonc<unknown>(rawArgsText);
    if (!argsVal || typeof argsVal !== "object" || Array.isArray(argsVal)) {
      continue;
    }

    const keySpan = props.get("key");
    const rootKeyVal = keySpan
      ? parseJsonc<unknown>(text.slice(keySpan.start, keySpan.end))
      : undefined;
    const rootKey = typeof rootKeyVal === "string" ? rootKeyVal : undefined;

    const normalized = normalizeTrackArgs(
      argsVal as Record<string, unknown>,
      rootKey,
    );
    const baseIndent = getLineIndentAt(text, argsSpan.start);
    const formattedArgs = serializeObjectWithIndent(
      normalized,
      baseIndent,
      indentUnit,
    );

    if (formattedArgs !== rawArgsText) {
      replacements.push({
        start: argsSpan.start,
        end: argsSpan.end,
        newText: formattedArgs,
      });
    }
  }

  return replacements;
}
