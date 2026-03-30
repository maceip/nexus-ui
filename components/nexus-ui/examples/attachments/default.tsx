import {
  Attachment,
  AttachmentList,
  type AttachmentMeta,
} from "@/components/nexus-ui/attachments";

const imgSrc =
  "https://images.unsplash.com/photo-1538428494232-9c0d8a3ab403?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

const items: AttachmentMeta[] = [
  {
    type: "image",
    name: "photo.jpg",
    url: imgSrc,
    mimeType: "image/jpeg",
  },
  { type: "file", name: "notes.txt", mimeType: "text/plain" },
  { type: "video", name: "clip.mp4", mimeType: "video/mp4" },
  { type: "audio", name: "song.mp3", mimeType: "audio/mpeg" },
];

function AttachmentsDefault() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <AttachmentList>
        {items.map((item) => (
          <Attachment
            key={`${item.name}-${item.type}-${item.mimeType}`}
            variant="compact"
            attachment={item}
          />
        ))}
      </AttachmentList>
    </div>
  );
}

export default AttachmentsDefault;
