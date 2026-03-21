"use client";

import { Tooltip } from "antd";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

function SunIcon({ style }: { style?: React.CSSProperties }) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {rays.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = +(12 + 7.5 * Math.cos(rad)).toFixed(2);
        const y1 = +(12 + 7.5 * Math.sin(rad)).toFixed(2);
        const x2 = +(12 + 10 * Math.cos(rad)).toFixed(2);
        const y2 = +(12 + 10 * Math.sin(rad)).toFixed(2);
        return (
          <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        );
      })}
    </svg>
  );
}

function MoonIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={style}>
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <div style={{ width: 36, height: 36 }} />;

  const isDark = resolvedTheme === "dark";

  return (
    <Tooltip title={isDark ? "라이트 모드" : "다크 모드"}>
      <button
        onClick={() => setTheme(isDark ? "light" : "dark")}
        style={{
          width: 36, height: 36,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          padding: 0,
        }}
        aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      >
        <span style={{ position: "relative", width: 18, height: 18, display: "block" }}>
          {/* Sun */}
          <SunIcon
            style={{
              position: "absolute",
              inset: 0,
              color: "#F7A600",
              opacity: isDark ? 0 : 1,
              transform: isDark
                ? "rotate(-45deg) scale(0.5)"
                : "rotate(0deg) scale(1)",
              transition: `opacity 0.3s ${SPRING}, transform 0.35s ${SPRING}`,
            }}
          />
          {/* Moon */}
          <MoonIcon
            style={{
              position: "absolute",
              inset: 0,
              color: "#8B95A1",
              opacity: isDark ? 1 : 0,
              transform: isDark
                ? "rotate(0deg) scale(1)"
                : "rotate(45deg) scale(0.5)",
              transition: `opacity 0.3s ${SPRING}, transform 0.35s ${SPRING}`,
            }}
          />
        </span>
      </button>
    </Tooltip>
  );
}
