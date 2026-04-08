"use client";

/**
 * Streamdown `components.code` for fenced blocks: Shiki via {@link @streamdown/code},
 * line numbers, fence meta (`startLine`, `noLineNumbers`), `data-incomplete` while
 * streaming, and `StreamdownContext.shikiTheme`.
 *
 * Set `components.inlineCode` to a plain `<code>` (see
 * [Streamdown inline code](https://streamdown.ai/docs/components#inline-code)).
 */

import { code as codeHighlighter } from "@streamdown/code";
import type { Element as HastElement } from "hast";
import {
  type ComponentProps,
  type CSSProperties,
  type DetailedHTMLProps,
  type HTMLAttributes,
  type ReactNode,
  isValidElement,
  memo,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  BundledLanguage,
  CodeHighlighterPlugin,
  ExtraProps,
} from "streamdown";
import { StreamdownContext, useIsCodeFenceIncomplete } from "streamdown";
import { cn } from "@/lib/utils";

const LANGUAGE_REGEX = /language-([^\s]+)/;
const START_LINE_PATTERN = /startLine=(\d+)/;
const NO_LINE_NUMBERS_PATTERN = /\bnoLineNumbers\b/;

function sameNodePosition(prev?: HastElement, next?: HastElement): boolean {
  if (!(prev?.position || next?.position)) return true;
  if (!(prev?.position && next?.position)) return false;
  const ps = prev.position.start;
  const ns = next.position.start;
  const pe = prev.position.end;
  const ne = next.position.end;
  return (
    ps?.line === ns?.line &&
    ps?.column === ns?.column &&
    pe?.line === ne?.line &&
    pe?.column === ne?.column
  );
}

function extractCodeString(children: ReactNode): string {
  if (
    isValidElement(children) &&
    children.props &&
    typeof children.props === "object" &&
    "children" in children.props &&
    typeof (children.props as { children?: unknown }).children === "string"
  ) {
    return (children.props as { children: string }).children;
  }
  if (typeof children === "string") return children;
  return "";
}

function getMetastring(node?: HastElement): string | undefined {
  const raw = node?.properties?.metastring;
  return typeof raw === "string" ? raw : undefined;
}

type MarkdownCodeElementProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> &
  ExtraProps;

type HighlightResult = NonNullable<
  ReturnType<CodeHighlighterPlugin["highlight"]>
>;

function trimTrailingNewlines(str: string): string {
  let end = str.length;
  while (end > 0 && str[end - 1] === "\n") end--;
  return str.slice(0, end);
}

function buildRawHighlightResult(trimmed: string): HighlightResult {
  return {
    bg: "transparent",
    fg: "inherit",
    tokens: trimmed.split("\n").map((line) => [
      {
        content: line,
        color: "inherit",
        bgColor: "transparent",
        htmlStyle: {},
        offset: 0,
      },
    ]),
  };
}

function parseRootStyle(rootStyle: string): Record<string, string> {
  const style: Record<string, string> = {};
  for (const decl of rootStyle.split(";")) {
    const idx = decl.indexOf(":");
    if (idx > 0) {
      const prop = decl.slice(0, idx).trim();
      const val = decl.slice(idx + 1).trim();
      if (prop && val) style[prop] = val;
    }
  }
  return style;
}

const LINE_NUMBER_CLASSES = cn(
  "block",
  "before:content-[counter(line)]",
  "before:inline-block",
  "before:[counter-increment:line]",
  "before:w-6",
  "before:mr-4",
  "before:text-[13px]",
  "before:text-right",
  "before:text-gray-400/60",
  "dark:before:text-gray-500/60",
  "before:font-mono",
  "before:select-none",
);

type CodeBlockBodyProps = ComponentProps<"div"> & {
  result: HighlightResult;
  language: string;
  startLine?: number;
  lineNumbers?: boolean;
};

const CodeBlockBody = memo(
  function CodeBlockBody({
    result,
    language,
    className,
    startLine,
    lineNumbers = true,
    ...rest
  }: CodeBlockBodyProps) {
    const preStyle = useMemo(() => {
      const style: Record<string, string> = {};
      if (result.bg) style["--sdm-bg"] = result.bg;
      if (result.fg) style["--sdm-fg"] = result.fg;
      if (result.rootStyle && typeof result.rootStyle === "string") {
        Object.assign(style, parseRootStyle(result.rootStyle));
      }
      return style as CSSProperties;
    }, [result.bg, result.fg, result.rootStyle]);

    return (
      <div
        className={cn(
          "overflow-x-auto rounded-md border border-gray-200 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-950",
          className,
        )}
        data-language={language}
        data-slot="nexus-code-block-body"
        {...rest}
      >
        <pre
          className={cn(
            "bg-(--sdm-bg,inherit) dark:bg-(--shiki-dark-bg,var(--sdm-bg,inherit))",
          )}
          style={preStyle}
        >
          <code
            className={
              lineNumbers
                ? "[counter-increment:line_0] [counter-reset:line]"
                : undefined
            }
            style={
              lineNumbers && startLine && startLine > 1
                ? { counterReset: `line ${startLine - 1}` }
                : undefined
            }
          >
            {result.tokens.map((row, rowIndex) => (
              <span
                key={rowIndex}
                className={lineNumbers ? LINE_NUMBER_CLASSES : undefined}
              >
                {row.length === 0 || (row.length === 1 && row[0].content === "")
                  ? "\n"
                  : row.map((token, tokenIndex) => {
                      const tokenStyle: Record<string, string> = {};
                      let hasBg = Boolean(token.bgColor);
                      if (token.color) tokenStyle["--sdm-c"] = token.color;
                      if (token.bgColor)
                        tokenStyle["--sdm-tbg"] = token.bgColor;
                      if (token.htmlStyle) {
                        for (const [key, value] of Object.entries(
                          token.htmlStyle,
                        )) {
                          if (value == null) continue;
                          if (key === "color") {
                            tokenStyle["--sdm-c"] = String(value);
                          } else if (key === "background-color") {
                            tokenStyle["--sdm-tbg"] = String(value);
                            hasBg = true;
                          } else {
                            tokenStyle[key] = String(value);
                          }
                        }
                      }
                      const htmlAttrs = (
                        token as {
                          htmlAttrs?: Record<string, string | undefined>;
                        }
                      ).htmlAttrs;
                      return (
                        <span
                          key={tokenIndex}
                          className={cn(
                            "text-(--sdm-c,inherit)",
                            "dark:text-(--shiki-dark,var(--sdm-c,inherit))",
                            hasBg && "bg-(--sdm-tbg)",
                            hasBg && "dark:bg-(--shiki-dark-bg,var(--sdm-tbg))",
                          )}
                          style={tokenStyle as CSSProperties}
                          {...htmlAttrs}
                        >
                          {token.content}
                        </span>
                      );
                    })}
              </span>
            ))}
          </code>
        </pre>
      </div>
    );
  },
  (prev, next) =>
    prev.result === next.result &&
    prev.language === next.language &&
    prev.className === next.className &&
    prev.startLine === next.startLine &&
    prev.lineNumbers === next.lineNumbers,
);

function HighlightedCodeBlockBody({
  code,
  language,
  raw,
  className,
  startLine,
  lineNumbers,
  codePlugin,
}: {
  code: string;
  language: string;
  raw: HighlightResult;
  className?: string;
  startLine?: number;
  lineNumbers?: boolean;
  codePlugin: CodeHighlighterPlugin;
}) {
  const { shikiTheme } = useContext(StreamdownContext);
  const [result, setResult] = useState<HighlightResult>(raw);

  useEffect(() => {
    const sync = codePlugin.highlight(
      {
        code,
        language: language as BundledLanguage,
        themes: shikiTheme,
      },
      (highlighted) => setResult(highlighted),
    );
    if (sync) setResult(sync);
  }, [code, language, shikiTheme, codePlugin, raw]);

  return (
    <CodeBlockBody
      className={className}
      language={language}
      lineNumbers={lineNumbers}
      result={result}
      startLine={startLine}
    />
  );
}

type FenceCodeBlockViewProps = {
  code: string;
  language: string;
  className?: string;
  isIncomplete?: boolean;
  startLine?: number;
  lineNumbers?: boolean;
  codePlugin?: CodeHighlighterPlugin;
};

function FenceCodeBlockView({
  code,
  language,
  className,
  isIncomplete,
  startLine,
  lineNumbers = true,
  codePlugin = codeHighlighter,
}: FenceCodeBlockViewProps) {
  const trimmed = useMemo(() => trimTrailingNewlines(code), [code]);
  const raw = useMemo(() => buildRawHighlightResult(trimmed), [trimmed]);

  return (
    <div
      className={cn(
        "my-4 flex w-full flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-900/50",
        className,
      )}
      data-incomplete={isIncomplete || undefined}
      data-language={language}
      data-slot="nexus-code-block"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 200px" }}
    >
      <div className="flex h-8 items-center text-xs text-gray-500 dark:text-gray-400">
        <span className="ml-1 font-mono lowercase">{language}</span>
      </div>
      <HighlightedCodeBlockBody
        code={trimmed}
        codePlugin={codePlugin}
        language={language}
        lineNumbers={lineNumbers}
        raw={raw}
        startLine={startLine}
      />
    </div>
  );
}

/** Streamdown fenced `code` only — use `components.inlineCode` for backtick spans. */
export const NexusCodeBlock = memo(
  function NexusCodeBlock({
    node,
    className,
    children,
  }: MarkdownCodeElementProps) {
    const { lineNumbers: contextLineNumbers } = useContext(StreamdownContext);
    const isIncompleteFence = useIsCodeFenceIncomplete();

    const match = className?.match(LANGUAGE_REGEX);
    const language = match?.[1] ?? "";

    const metastring = getMetastring(node);
    const startLineMatch = metastring?.match(START_LINE_PATTERN);
    const parsedStart = startLineMatch
      ? Number.parseInt(startLineMatch[1], 10)
      : undefined;
    const startLine =
      parsedStart !== undefined && parsedStart >= 1 ? parsedStart : undefined;
    const metaNoLineNumbers = metastring
      ? NO_LINE_NUMBERS_PATTERN.test(metastring)
      : false;
    const showLineNumbers = !metaNoLineNumbers && contextLineNumbers !== false;

    const codeText = extractCodeString(children);

    return (
      <FenceCodeBlockView
        className={className}
        code={codeText}
        codePlugin={codeHighlighter}
        isIncomplete={isIncompleteFence}
        language={language}
        lineNumbers={showLineNumbers}
        startLine={startLine}
      />
    );
  },
  (p, n) => p.className === n.className && sameNodePosition(p.node, n.node),
);
NexusCodeBlock.displayName = "NexusCodeBlock";
