import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          backgroundImage: `linear-gradient(135deg, #171717 0%, #0a0a0a 50%, #262626 100%)`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 48,
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: "white",
              marginBottom: 16,
              letterSpacing: "-0.02em",
            }}
          >
            {SITE_NAME}
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#a3a3a3",
              maxWidth: 600,
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            {SITE_DESCRIPTION}
          </div>
          <div
            style={{
              marginTop: 32,
              fontSize: 18,
              color: "#737373",
            }}
          >
            nexus-ui.dev
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
