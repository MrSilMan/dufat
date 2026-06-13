import { ImageResponse } from "next/og";

export const alt = "Dufat, Lda. — Iluminamos o futuro de Angola";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #04090F 0%, #114F8C 130%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ color: "#fff", fontSize: 160, fontWeight: 900 }}>D</span>
          <div
            style={{
              display: "flex",
              background: "#fff",
              padding: "8px 36px",
              marginLeft: 12,
            }}
          >
            <span style={{ color: "#114F8C", fontSize: 96, fontWeight: 800, letterSpacing: 10 }}>
              UFAT
            </span>
          </div>
          <span style={{ color: "#fff", fontSize: 28, fontWeight: 700, marginLeft: 14, marginTop: 80 }}>
            LDA.
          </span>
        </div>
        <p style={{ color: "#8FC3FF", fontSize: 36, marginTop: 36 }}>
          Iluminamos o futuro de Angola
        </p>
      </div>
    ),
    size,
  );
}
