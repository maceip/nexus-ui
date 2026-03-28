import {
  Attachment,
  AttachmentList,
  Attachments,
  type AttachmentMeta,
} from "@/components/nexus-ui/attachments";

const imgSrc =
  "https://images.unsplash.com/photo-1538428494232-9c0d8a3ab403?q=80&w=1740&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

const boxAttachments: AttachmentMeta[] = [
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

const cardAttachments: AttachmentMeta[] = [
  {
    type: "image",
    name: "image.png",
    url: imgSrc,
    mimeType: "image/png",
    size: 1_258_291,
  },
  {
    type: "file",
    name: "untitled.pdf",
    mimeType: "application/pdf",
  },
  {
    type: "file",
    name: "untitled.doc",
    mimeType: "application/msword",
  },
  {
    type: "file",
    name: "untitled.pptx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    size: Math.round(21.3 * 1024 * 1024),
  },
];

const pillAttachments: AttachmentMeta[] = [
  {
    type: "image",
    name: "Skyline.png",
    url: imgSrc,
    mimeType: "image/png",
  },
  {
    type: "file",
    name: "Marketing-Plan.pdf",
    mimeType: "application/pdf",
  },
  {
    type: "file",
    name: "Report on Design.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    type: "file",
    name: "DEMO_SLIDES.pptx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
];

function AttachmentsDefault() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <Attachments>
        <AttachmentList>
          {boxAttachments.map((item) => (
            <Attachment
              key={`box-${item.name}-${item.type}-${item.mimeType}`}
              variant="box"
              data={item}
            />
          ))}
        </AttachmentList>

        <AttachmentList>
          {cardAttachments.map((item) => (
            <Attachment
              key={`card-${item.name}-${item.mimeType}`}
              variant="card"
              data={item}
            />
          ))}
        </AttachmentList>

        <AttachmentList>
          {pillAttachments.map((item) => (
            <Attachment
              key={`pill-${item.name}-${item.mimeType}`}
              variant="pill"
              data={item}
            />
          ))}
        </AttachmentList>
      </Attachments>
    </div>
  );
}

export default AttachmentsDefault;
