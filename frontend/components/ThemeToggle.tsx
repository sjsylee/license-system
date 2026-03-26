"use client";

import { Tooltip } from "antd";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const EASE_OUT = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

function SunIcon() {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {rays.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = +(12 + 7.2 * Math.cos(rad)).toFixed(2);
        const y1 = +(12 + 7.2 * Math.sin(rad)).toFixed(2);
        const x2 = +(12 + 9.8 * Math.cos(rad)).toFixed(2);
        const y2 = +(12 + 9.8 * Math.sin(rad)).toFixed(2);
        return (
          <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        );
      })}
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.5 6.5 0 0 0 10 10z"
        stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        fill="currentColor" fillOpacity="0.15"
      />
    </svg>
  );
}

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <div style={{ width: 36, height: 36 }} />;

  const isDark = resolvedTheme === "dark";

  return (
    <Tooltip title={isDark ? "라이트 모드" : "다크 모드"}>
      <button
        onClick={() => setTheme(isDark ? "light" : "dark")}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
        style={{
          width: 36,
          height: 36,
          border: isDark
            ? "1px solid rgba(255,255,255,0.12)"
            : "1px solid rgba(0,0,0,0.08)",
          background: isDark
            ? "rgba(255,255,255,0.07)"
            : "rgba(0,0,0,0.04)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          cursor: "pointer",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          padding: 0,
          overflow: "hidden",
          transform: hovered ? "scale(1.08)" : "scale(1)",
          transition: `transform 0.2s ${SPRING}, background 0.25s ${EASE_OUT}, border-color 0.25s ${EASE_OUT}`,
        }}
      >
        {/* Sun */}
        <span
          style={{
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#F7A600",
            opacity: isDark ? 0 : 1,
            transform: isDark
              ? "translateY(14px) scale(0.6)"
              : "translateY(0px) scale(1)",
            transition: `opacity 0.28s ${EASE_OUT}, transform 0.35s ${SPRING}`,
          }}
        >
          <SunIcon />
        </span>

        {/* Moon */}
        <span
          style={{
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#A5B4FC",
            opacity: isDark ? 1 : 0,
            transform: isDark
              ? "translateY(0px) scale(1)"
              : "translateY(-14px) scale(0.6)",
            transition: `opacity 0.28s ${EASE_OUT}, transform 0.35s ${SPRING}`,
          }}
        >
          <MoonIcon />
        </span>
      </button>
    </Tooltip>
  );
}
