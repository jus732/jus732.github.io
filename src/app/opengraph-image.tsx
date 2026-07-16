import { ImageResponse } from "next/og";

import { site } from "@/lib/site";

export const alt = `${site.name} - ${site.role}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Rendered at build time from site.ts, so it stays in sync with the content
// source of truth. Colors mirror the dark theme in globals.css.
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          backgroundColor: "#0a0d12",
          color: "#f7f8fa",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "88px",
            height: "88px",
            borderRadius: "20px",
            backgroundColor: "#4d9fff",
            color: "#06101c",
            fontSize: "40px",
            fontWeight: 700,
            marginBottom: "48px",
          }}
        >
          {site.initials}
        </div>
        <div style={{ fontSize: "72px", fontWeight: 700, lineHeight: 1.1 }}>
          {site.name}
        </div>
        <div style={{ fontSize: "36px", color: "#4d9fff", marginTop: "16px" }}>
          {site.role}
        </div>
        <div
          style={{
            fontSize: "28px",
            color: "#9aa4b2",
            marginTop: "32px",
            maxWidth: "900px",
            lineHeight: 1.4,
          }}
        >
          {site.tagline}
        </div>
      </div>
    ),
    size
  );
}
