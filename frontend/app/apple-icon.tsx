import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: "linear-gradient(135deg, #3182F6 0%, #1248c7 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="100"
          height="100"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="7.5" cy="10" r="3.6" stroke="white" strokeWidth="1.75" />
          <line
            x1="10.4"
            y1="10"
            x2="18"
            y2="10"
            stroke="white"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <line
            x1="15.2"
            y1="10"
            x2="15.2"
            y2="12.5"
            stroke="white"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <line
            x1="17.4"
            y1="10"
            x2="17.4"
            y2="11.8"
            stroke="white"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
