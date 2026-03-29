"use client";

import * as React from "react";
import { ArrowUp02Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Attachment,
  AttachmentList,
  Attachments,
  AttachmentTrigger,
  type AttachmentMeta,
} from "@/components/nexus-ui/attachments";
import PromptInput, {
  PromptInputAction,
  PromptInputActionGroup,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/nexus-ui/prompt-input";
import { Button } from "@/components/ui/button";

function attachmentKey(a: AttachmentMeta) {
  return `${a.name ?? ""}-${a.size ?? ""}-${a.mimeType ?? ""}-${a.url ?? ""}`;
}

function AttachmentsWithPromptInput() {
  const [message, setMessage] = React.useState("");
  const [attachments, setAttachments] = React.useState<AttachmentMeta[]>([]);

  const syncAttachments = React.useCallback((next: AttachmentMeta[]) => {
    setAttachments((prev) => {
      for (const a of prev) {
        const u = a.url;
        if (
          u?.startsWith("blob:") &&
          !next.some((n) => n.url === u)
        ) {
          URL.revokeObjectURL(u);
        }
      }
      return next;
    });
  }, []);

  const attachmentsRef = React.useRef(attachments);
  attachmentsRef.current = attachments;
  React.useEffect(
    () => () => {
      for (const a of attachmentsRef.current) {
        if (a.url?.startsWith("blob:")) URL.revokeObjectURL(a.url);
      }
    },
    [],
  );

  const removeAttachment = React.useCallback((item: AttachmentMeta) => {
    syncAttachments(
      attachmentsRef.current.filter(
        (a) => attachmentKey(a) !== attachmentKey(item),
      ),
    );
  }, [syncAttachments]);

  const handleSubmit = React.useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed && attachmentsRef.current.length === 0) return;
      setMessage("");
      syncAttachments([]);
    },
    [syncAttachments],
  );

  const canSend =
    message.trim().length > 0 || attachments.length > 0;

  return (
    <div className="mx-auto w-full max-w-xl">
       <Attachments
          attachments={attachments}
          onAttachmentsChange={syncAttachments}
          accept="*/*"
          multiple
        > 
        <PromptInput onSubmit={handleSubmit}>
      
          {attachments.length > 0 ? (
            <AttachmentList className="min-h-0 flex-nowrap justify-start overflow-x-auto overflow-y-hidden px-4 pt-4">
              {attachments.map((item) => (
                <Attachment
                  key={attachmentKey(item)}
                  variant="card"
                  attachment={item}
                  onRemove={() => removeAttachment(item)}
                />
              ))}
            </AttachmentList>
          ) : null}
          <PromptInputTextarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message with attachments…"
          />
          <PromptInputActions>
            <PromptInputActionGroup>
              <PromptInputAction asChild>
                <AttachmentTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 cursor-pointer rounded-full border-none bg-transparent text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
                  >
                    <HugeiconsIcon
                      icon={PlusSignIcon}
                      strokeWidth={2.0}
                      className="size-4"
                    />
                  </Button>
                </AttachmentTrigger>
              </PromptInputAction>
            </PromptInputActionGroup>
            <PromptInputActionGroup>
              <PromptInputAction asChild>
                <Button
                  type="button"
                  className="size-8 cursor-pointer rounded-full bg-gray-700 text-white transition-transform hover:bg-gray-800 active:scale-97 disabled:opacity-70 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                  disabled={!canSend}
                  onClick={() => handleSubmit(message)}
                >
                  <HugeiconsIcon
                    icon={ArrowUp02Icon}
                    strokeWidth={2.0}
                    className="size-4"
                  />
                </Button>
              </PromptInputAction>
            </PromptInputActionGroup>
          </PromptInputActions>
      </PromptInput>  
       </Attachments>
    </div>
  );
}

export default AttachmentsWithPromptInput;
