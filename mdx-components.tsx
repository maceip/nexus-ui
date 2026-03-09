import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import {
  CodeBlock,
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
} from "./components/codeblock";
import { Pre } from "fumadocs-ui/components/codeblock";
import { Tab, Tabs } from "./components/tabs";
import { TypeTable } from "./components/type-table";
import { Step, Steps } from "./components/steps";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
    Tab,
    Tabs,
    Step,
    Steps,
    TypeTable,
    CodeBlockTab,
    CodeBlockTabs,
    CodeBlockTabsList,
    CodeBlockTabsTrigger,
    table: (props) => (
      <div
        className={[
          "my-6 prose-no-margin overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 dark:border-white/10 dark:bg-white/5",
          "[&_tbody_tr:first-child_td:first-child]:rounded-tl-xl",
          "[&_tbody_tr:first-child_td:last-child]:rounded-tr-xl",
          "[&_tbody_tr:last-child_td:first-child]:rounded-bl-xl",
          "[&_tbody_tr:last-child_td:last-child]:rounded-br-xl",
        ].join(" ")}
      >
        <table
          className="w-full border-separate border-spacing-0 border-none text-sm"
          {...props}
        />
      </div>
    ),
    th: (props) => (
      <th
        className="border-none px-6 py-2.5 text-left text-[14px] font-normal! text-gray-400!"
        {...props}
      />
    ),
    td: (props) => (
      <td
        className="border-0 border-gray-100 bg-white px-6 py-3.5 text-[14px] dark:border-white/10 dark:bg-background [tr:not(:first-child)_&]:border-t"
        {...props}
      />
    ),
    pre: ({ ref: _ref, ...props }) => (
      <CodeBlock {...props}>
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
  };
}
