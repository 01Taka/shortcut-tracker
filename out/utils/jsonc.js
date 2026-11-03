"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsonc = parseJsonc;
/**
 * コメント付きJSON（JSONC）の高速・安全なパーサー
 * - チャンク切り出しにより1文字ずつの文字列結合アロケーションを回避
 * - 文字列リテラル内のカンマ（",}" など）を壊さずに末尾カンマのみを除去
 */
function parseJsonc(text) {
    const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const len = clean.length;
    const chunks = [];
    let sliceStart = 0;
    let i = 0;
    while (i < len) {
        const code = clean.charCodeAt(i);
        // 文字列リテラル ("..." または '...')
        if (code === 34 || code === 39) {
            const quoteCode = code;
            i++;
            while (i < len) {
                const ch = clean.charCodeAt(i);
                if (ch === 92) {
                    // バックスラッシュによるエスケープをスキップ
                    i += 2;
                    continue;
                }
                i++;
                if (ch === quoteCode) {
                    break;
                }
            }
            continue;
        }
        // コメント判定 ('/')
        if (code === 47 && i + 1 < len) {
            const nextCode = clean.charCodeAt(i + 1);
            // 単一行コメント (// ...)
            if (nextCode === 47) {
                if (i > sliceStart) {
                    chunks.push(clean.slice(sliceStart, i));
                }
                i += 2;
                while (i < len && clean.charCodeAt(i) !== 10) {
                    i++;
                }
                // 改行自体は残して行番号を維持
                sliceStart = i;
                continue;
            }
            // ブロックコメント (/* ... */)
            if (nextCode === 42) {
                if (i > sliceStart) {
                    chunks.push(clean.slice(sliceStart, i));
                }
                i += 2;
                while (i < len) {
                    if (clean.charCodeAt(i) === 42 && clean.charCodeAt(i + 1) === 47) {
                        i += 2;
                        break;
                    }
                    i++;
                }
                sliceStart = i;
                continue;
            }
        }
        i++;
    }
    if (sliceStart < len) {
        chunks.push(clean.slice(sliceStart));
    }
    const withoutComments = chunks.length === 1 ? chunks[0] : chunks.join("");
    // 文字列リテラルを保護しつつ、オブジェクト/配列末尾のカンマ (trailing commas) を除去
    const normalized = withoutComments.replace(/("(?:\\.|[^"\\])*")|,\s*([}\]])/g, (match, strLiteral, closingBracket) => strLiteral !== undefined ? strLiteral : (closingBracket ?? match));
    return JSON.parse(normalized);
}
//# sourceMappingURL=jsonc.js.map