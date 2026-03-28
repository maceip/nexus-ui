"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Cancel01Icon,
  File02Icon,
  Video02Icon,
  MusicNote02Icon,
  Pdf02Icon,
  Doc02Icon,
  Ppt02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { mergeRefs } from "@/lib/merge-refs";
import { cn } from "@/lib/utils";

// ——— Metadata schema (single source) ———

/** Upload or message attachment metadata. */
export interface AttachmentMeta {
  type: "image" | "file" | "video" | "audio";
  name?: string;
  url?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  data?: Buffer | Blob;
}

export function toAttachmentMeta(
  file: File,
  options?: { objectUrl?: string },
): AttachmentMeta {
  const mime = file.type?.toLowerCase() ?? "";
  let kind: AttachmentMeta["type"] = "file";
  if (mime.startsWith("image/")) kind = "image";
  else if (mime.startsWith("video/")) kind = "video";
  else if (mime.startsWith("audio/")) kind = "audio";

  return {
    type: kind,
    name: file.name,
    url: options?.objectUrl,
    mimeType: file.type || undefined,
    size: file.size,
  };
}

function formatBytes(bytes?: number): string | undefined {
  if (bytes == null || !Number.isFinite(bytes)) return undefined;
  const units = ["B", "KB", "MB", "GB"] as const;
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const rounded = i === 0 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${rounded} ${units[i]}`;
}

function kindLabel(item: AttachmentMeta): string | undefined {
  const mime = item.mimeType?.toLowerCase() ?? "";
  if (mime.includes("pdf")) return "PDF";
  if (
    mime.includes("word") ||
    mime.includes("msword") ||
    mime.includes("officedocument.wordprocessing")
  )
    return "DOC";
  if (
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    mime.includes("ms-powerpoint")
  )
    return "PPTX";
  if (mime.includes("text/plain")) return "TXT";
  const ext = item.name?.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "PDF";
  if (ext === "doc" || ext === "docx") return "DOC";
  if (ext === "ppt" || ext === "pptx") return ext.toUpperCase();
  if (ext === "txt") return "TXT";
  return undefined;
}

function fileIconFor(item: AttachmentMeta) {
  const mime = item.mimeType?.toLowerCase() ?? "";
  const name = item.name?.toLowerCase() ?? "";
  if (mime.includes("pdf") || name.endsWith(".pdf")) return Pdf02Icon;
  if (
    mime.includes("word") ||
    mime.includes("msword") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx")
  )
    return Doc02Icon;
  if (
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    name.endsWith(".ppt") ||
    name.endsWith(".pptx")
  )
    return Ppt02Icon;
  if (item.type === "video") return Video02Icon;
  if (item.type === "audio") return MusicNote02Icon;
  return File02Icon;
}

function inferCardSubtitleMode(data: AttachmentMeta): "size" | "kind" {
  if (
    data.size != null &&
    Number.isFinite(data.size) &&
    data.size > 0
  ) {
    return "size";
  }
  return "kind";
}

const attachmentVariants = cva(
  "group relative cursor-default overflow-hidden rounded-[6px] border border-gray-100 text-gray-400 dark:border-gray-700 dark:text-gray-300",
  {
    variants: {
      variant: {
        box: "relative flex size-15 shrink-0 items-center justify-center",
        pill: "relative flex h-8 w-auto min-w-0 max-w-full shrink-0 items-center justify-start p-1 pr-2",
        card: "relative flex h-15 w-[181px] max-w-full shrink-0 items-center justify-start p-2",
      },
    },
    defaultVariants: {
      variant: "box",
    },
  },
);

type AttachmentVariant = NonNullable<
  VariantProps<typeof attachmentVariants>["variant"]
>;

function attachmentShellClass(
  variant: AttachmentVariant,
  data: AttachmentMeta,
): string {
  if (variant === "box") {
    if (data.type === "image" && data.url) return "";
    return "bg-gray-100 dark:bg-gray-700";
  }
  return "border-gray-100 bg-gray-100 dark:border-gray-700 dark:bg-gray-700";
}

// ——— Context ———

type AttachmentsContextValue = {
  inputRef: React.RefObject<HTMLInputElement | null>;
  openPicker: () => void;
};

const AttachmentsContext =
  React.createContext<AttachmentsContextValue | null>(null);

function useAttachmentsContext(component: string) {
  const ctx = React.useContext(AttachmentsContext);
  if (!ctx) {
    throw new Error(
      `${component} must be used within <Attachments>`,
    );
  }
  return ctx;
}

type AttachmentItemContextValue = {
  variant: AttachmentVariant;
  data: AttachmentMeta;
  onRemove?: () => void;
};

const AttachmentItemContext =
  React.createContext<AttachmentItemContextValue | null>(null);

function useAttachmentItemContext(component: string) {
  const ctx = React.useContext(AttachmentItemContext);
  if (!ctx) {
    throw new Error(
      `${component} must be used within <Attachment>`,
    );
  }
  return ctx;
}

type AttachmentsProps = {
  children?: React.ReactNode;
};

function Attachments({ children }: AttachmentsProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const openPicker = React.useCallback(() => {
    inputRef.current?.click();
  }, []);

  const value = React.useMemo<AttachmentsContextValue>(
    () => ({ inputRef, openPicker }),
    [],
  );

  return (
    <AttachmentsContext.Provider value={value}>
      {children}
    </AttachmentsContext.Provider>
  );
}

type AttachmentInputProps = React.ComponentProps<"input">;

const AttachmentInput = React.forwardRef<HTMLInputElement, AttachmentInputProps>(
  function AttachmentInput(
    { className, type = "file", ...props },
    ref,
  ) {
    const { inputRef } = useAttachmentsContext("AttachmentInput");
    return (
      <input
        ref={mergeRefs(inputRef, ref)}
        type={type}
        className={cn("sr-only", className)}
        {...props}
      />
    );
  },
);

type AttachmentTriggerProps = React.ComponentProps<"button"> & {
  asChild?: boolean;
};

function AttachmentTrigger({
  asChild = false,
  className,
  children,
  onClick,
  ...props
}: AttachmentTriggerProps) {
  const { inputRef } = useAttachmentsContext("AttachmentTrigger");

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      inputRef.current?.click();
    },
    [onClick, inputRef],
  );

  if (asChild) {
    return (
      <Slot
        className={className}
        onClick={handleClick as React.MouseEventHandler<HTMLElement>}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      type="button"
      data-slot="attachment-trigger"
      className={cn(className)}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

type AttachmentListProps = React.HTMLAttributes<HTMLDivElement>;

function AttachmentList({ className, role, ...props }: AttachmentListProps) {
  return (
    <div
      data-slot="attachment-list"
      role={role ?? "list"}
      className={cn(
        "flex w-full max-w-full min-w-0 flex-wrap items-center justify-center gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:thin]",
        className,
      )}
      {...props}
    />
  );
}

function AttachmentPillFadeLayer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      data-slot="attachment-pill-fade"
      className={cn(
        "pointer-events-none absolute top-1/2 right-0 h-8 w-10 -translate-y-1/2 bg-linear-to-l from-gray-100 from-65% to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-gray-700",
        className,
      )}
      {...props}
    />
  );
}

type AttachmentProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  variant?: AttachmentVariant;
  /** Attachment metadata; drives preview and properties. */
  data: AttachmentMeta;
  onRemove?: () => void;
  /** Card secondary line; inferred from `data.size` when omitted. */
  cardSubtitle?: "size" | "kind";
  children?: React.ReactNode;
};

function Attachment({
  className,
  variant = "box",
  data,
  onRemove,
  cardSubtitle: cardSubtitleProp,
  children,
  ...props
}: AttachmentProps) {
  const cardSubtitle =
    variant === "card"
      ? (cardSubtitleProp ?? inferCardSubtitleMode(data))
      : undefined;

  const ctxValue = React.useMemo<AttachmentItemContextValue>(
    () => ({ variant: variant ?? "box", data, onRemove }),
    [variant, data, onRemove],
  );

  const shell = attachmentShellClass(variant ?? "box", data);

  const defaultLayout =
    variant === "box" ? (
      <>
        <AttachmentRemove />
        <AttachmentPreview />
      </>
    ) : variant === "card" ? (
      <>
        <AttachmentRemove />
        <div className="flex min-w-0 items-center gap-2">
          <AttachmentPreview />
          <AttachmentInfo>
            <AttachmentProperty as="name" />
            <AttachmentProperty
              as={cardSubtitle === "size" ? "size" : "kind"}
            />
          </AttachmentInfo>
        </div>
      </>
    ) : (
      <>
        <AttachmentRemove />
        <div className="flex min-w-0 items-center gap-1">
          <AttachmentPreview />
          <AttachmentProperty as="name" />
        </div>
      </>
    );

  return (
    <AttachmentItemContext.Provider value={ctxValue}>
      <div
        data-slot="attachment"
        data-variant={variant}
        role="listitem"
        className={cn(attachmentVariants({ variant }), shell, className)}
        {...props}
      >
        {variant === "pill" ? <AttachmentPillFadeLayer /> : null}
        {children ?? defaultLayout}
      </div>
    </AttachmentItemContext.Provider>
  );
}

const attachmentPreviewVariants = cva(
  "flex shrink-0 items-center justify-center overflow-hidden bg-white text-gray-400 dark:bg-gray-800 dark:text-gray-300",
  {
    variants: {
      variant: {
        box: "absolute inset-0 size-full rounded-[inherit] border-0 bg-transparent dark:bg-transparent",
        pill: "size-6 rounded-[4px] border border-gray-200 dark:border-gray-600",
        card: "size-11 rounded-[6px] border border-gray-200 dark:border-gray-600",
      },
    },
    defaultVariants: {
      variant: "box",
    },
  },
);

type AttachmentPreviewProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> &
  Partial<VariantProps<typeof attachmentPreviewVariants>>;

function AttachmentPreview({
  className,
  variant: variantProp,
  ...props
}: AttachmentPreviewProps) {
  const { variant, data } = useAttachmentItemContext("AttachmentPreview");
  const v = variantProp ?? variant;
  const isImage = data.type === "image" && Boolean(data.url);
  const pillPlainIcon =
    v === "pill" && !isImage
      ? "border-0 bg-transparent dark:bg-transparent"
      : "";

  const iconClass = v === "pill" ? "size-5" : "size-7";

  const content = (() => {
    if (isImage && data.url) {
      return (
        <img
          src={data.url}
          alt=""
          className="size-full object-cover"
        />
      );
    }
    return (
      <HugeiconsIcon
        icon={fileIconFor(data)}
        strokeWidth={1.5}
        className={iconClass}
      />
    );
  })();

  return (
    <div
      data-slot="attachment-preview"
      className={cn(attachmentPreviewVariants({ variant: v }), pillPlainIcon, className)}
      {...props}
    >
      {content}
    </div>
  );
}

const removeButtonVariants = cva(
  "z-10 flex size-4.5 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-500 active:scale-97 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:hover:text-gray-100",
  {
    variants: {
      position: {
        corner: "absolute top-1 right-1",
        "center-end": "absolute top-1/2 right-1 -translate-y-1/2",
      },
    },
    defaultVariants: {
      position: "corner",
    },
  },
);

type AttachmentRemoveProps = React.ComponentProps<"button"> &
  VariantProps<typeof removeButtonVariants> & {
    asChild?: boolean;
  };

function AttachmentRemove({
  className,
  asChild = false,
  position: positionProp,
  children,
  type: _type,
  onClick,
  "aria-label": ariaLabelProp,
  ...props
}: AttachmentRemoveProps) {
  const { variant, data, onRemove } = useAttachmentItemContext(
    "AttachmentRemove",
  );
  const position =
    positionProp ??
    (variant === "box" ? "corner" : "center-end");

  const ariaLabel =
    ariaLabelProp ?? `Remove ${data.name ?? "attachment"}`;

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      onRemove?.();
    },
    [onClick, onRemove],
  );

  if (asChild) {
    return (
      <Slot
        className={cn(removeButtonVariants({ position }), className)}
        aria-label={ariaLabel}
        onClick={handleClick as React.MouseEventHandler<HTMLElement>}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      type="button"
      data-slot="attachment-remove"
      className={cn(removeButtonVariants({ position }), className)}
      aria-label={ariaLabel}
      onClick={handleClick}
      {...props}
    >
      {children ?? (
        <HugeiconsIcon
          icon={Cancel01Icon}
          strokeWidth={2.5}
          className="size-3"
        />
      )}
    </button>
  );
}

type AttachmentInfoProps = React.HTMLAttributes<HTMLDivElement>;

function AttachmentInfo({ className, ...props }: AttachmentInfoProps) {
  return (
    <div
      data-slot="attachment-info"
      className={cn("flex min-w-0 flex-col gap-0", className)}
      {...props}
    />
  );
}

type AttachmentPropertyAs = "name" | "size" | "kind";

type AttachmentPropertyProps = Omit<
  React.HTMLAttributes<HTMLParagraphElement>,
  "children"
> & {
  as: AttachmentPropertyAs;
};

function AttachmentProperty({
  as: mode,
  className,
  ...props
}: AttachmentPropertyProps) {
  const { data } = useAttachmentItemContext("AttachmentProperty");
  let text: string;
  if (mode === "name") {
    text = data.name ?? "";
  } else if (mode === "size") {
    text = formatBytes(data.size) ?? "—";
  } else {
    text = kindLabel(data) ?? "—";
  }

  const isTitle = mode === "name";
  return (
    <p
      data-slot="attachment-property"
      data-as={mode}
      className={cn(
        isTitle
          ? "my-0! truncate text-sm leading-6 font-[450] text-gray-900 dark:text-gray-100"
          : "my-0! text-xs font-[350] text-gray-500 dark:text-gray-400",
        className,
      )}
      {...props}
    >
      {text}
    </p>
  );
}

type AttachmentProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  /** 0–100 */
  value: number;
};

function AttachmentProgress({
  className,
  value,
  ...props
}: AttachmentProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      data-slot="attachment-progress"
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-gray-200/90 dark:bg-gray-600/90",
        className,
      )}
      {...props}
    >
      <div
        className="h-full bg-gray-900 transition-[width] duration-200 dark:bg-gray-100"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

Attachments.displayName = "Attachments";
AttachmentInput.displayName = "AttachmentInput";
AttachmentTrigger.displayName = "AttachmentTrigger";
AttachmentList.displayName = "AttachmentList";
Attachment.displayName = "Attachment";
AttachmentPreview.displayName = "AttachmentPreview";
AttachmentRemove.displayName = "AttachmentRemove";
AttachmentInfo.displayName = "AttachmentInfo";
AttachmentProperty.displayName = "AttachmentProperty";
AttachmentProgress.displayName = "AttachmentProgress";

export {
  Attachments,
  AttachmentInput,
  AttachmentTrigger,
  AttachmentList,
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  AttachmentInfo,
  AttachmentProperty,
  AttachmentProgress,
};

export default Attachments;
