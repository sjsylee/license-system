"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider, theme as antTheme } from "antd";
import koKR from "antd/locale/ko_KR";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const TOSS_BLUE = "#3182F6";

const baseToken = {
  colorPrimary: TOSS_BLUE,
  colorSuccess: "#00B448",
  colorWarning: "#F7A600",
  colorError: "#F04452",
  colorInfo: TOSS_BLUE,
  fontFamily:
    "'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontSize: 14,
  borderRadius: 10,
  borderRadiusLG: 14,
  borderRadiusSM: 6,
  motionDurationMid: "0.15s",
  motionDurationSlow: "0.2s",
  boxShadow:
    "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)",
  boxShadowSecondary:
    "0 4px 12px 0 rgba(0,0,0,0.08), 0 2px 6px -2px rgba(0,0,0,0.06)",
};

const lightToken = {
  ...baseToken,
  colorBgBase: "#ffffff",
  colorBgContainer: "#ffffff",
  colorBgLayout: "#F5F6F8",
  colorBgElevated: "#ffffff",
  colorBorder: "#EBEBEB",
  colorBorderSecondary: "#F2F2F2",
  colorTextBase: "#191F28",
  colorTextSecondary: "#6B7684",
  colorFillAlter: "#F8F9FA",
};

const darkToken = {
  ...baseToken,
  colorBgBase: "#141414",
  colorBgContainer: "#1C1C1E",
  colorBgLayout: "#0F0F10",
  colorBgElevated: "#242426",
  colorBorder: "#2C2C2E",
  colorBorderSecondary: "#242426",
  colorTextBase: "#F2F4F6",
  colorTextSecondary: "#8B95A1",
  colorFillAlter: "#242426",
};

const componentTokens = {
  Button: {
    controlHeight: 40,
    controlHeightLG: 48,
    fontWeight: 600,
    paddingInline: 20,
  },
  Card: {
    paddingLG: 24,
  },
  Input: {
    controlHeight: 40,
    controlHeightLG: 48,
  },
  Select: {
    controlHeight: 40,
  },
  Table: {
    headerBg: "transparent",
    rowHoverBg: "rgba(49, 130, 246, 0.04)",
  },
  Layout: {
    siderBg: "transparent",
    headerBg: "transparent",
  },
  Menu: {
    itemBorderRadius: 10,
    itemMarginInline: 8,
    itemHeight: 44,
  },
  Tag: {
    borderRadius: 6,
  },
  Badge: {},
};

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <AntdRegistry>
      <ConfigProvider
        locale={koKR}
        theme={{
          algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
          token: isDark ? darkToken : lightToken,
          components: componentTokens,
        }}
      >
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
