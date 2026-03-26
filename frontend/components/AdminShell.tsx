"use client";

import {
  AppstoreOutlined,
  DownOutlined,
  ImportOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Button, Drawer, Layout, Tooltip, Typography, theme } from "antd";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import ThemeToggle from "./ThemeToggle";
import { logout } from "@/lib/auth";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

type NavChild = { key: string; icon: React.ReactNode; label: string };
type NavItem =
  | { type: "item"; key: string; icon: React.ReactNode; label: string }
  | { type: "group"; icon: React.ReactNode; label: string; children: NavChild[] };

const NAV_ITEMS: NavItem[] = [
  { type: "item", key: "/admin", icon: <AppstoreOutlined />, label: "대시보드" },
  { type: "item", key: "/admin/programs", icon: <KeyOutlined />, label: "프로그램 관리" },
  {
    type: "group",
    icon: <ToolOutlined />,
    label: "도구",
    children: [
      { key: "/admin/migrate", icon: <ImportOutlined />, label: "데이터 마이그레이션" },
    ],
  },
];

function NavBtn({
  icon, label, active, collapsed, onClick, indent = false,
}: {
  icon: React.ReactNode; label: string; active: boolean;
  collapsed?: boolean; onClick: () => void; indent?: boolean;
}) {
  const { token } = theme.useToken();
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: collapsed ? "0 10px" : indent ? "0 12px 0 36px" : "0 12px",
        height: 52,
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: indent ? 13 : 14,
        fontWeight: active ? 600 : 500,
        color: active ? "#3182F6" : token.colorTextSecondary,
        background: active ? "rgba(49,130,246,0.08)" : "transparent",
        transition: "background 0.15s, color 0.15s",
        justifyContent: collapsed ? "center" : "flex-start",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = token.colorFillAlter;
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <span style={{ fontSize: indent ? 15 : 18, color: active ? "#3182F6" : token.colorTextSecondary, display: "flex", alignItems: "center", flexShrink: 0 }}>
        {icon}
      </span>
      {!collapsed && <span style={{ flex: 1, textAlign: "left" }}>{label}</span>}
    </button>
  );
}

function NavMenu({
  pathname,
  onNavigate,
  collapsed,
}: {
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const router = useRouter();
  const { token } = theme.useToken();

  const allKeys = NAV_ITEMS.flatMap((item) =>
    item.type === "item" ? [item.key] : item.children.map((c) => c.key)
  );
  const selectedKey =
    allKeys.slice().reverse().find((k) => pathname.startsWith(k)) ?? "/admin";

  // 현재 활성 경로가 포함된 그룹은 기본 열림
  const defaultOpen = NAV_ITEMS.filter(
    (item) => item.type === "group" && item.children.some((c) => pathname.startsWith(c.key))
  ).map((item) => item.label);
  const [openGroups, setOpenGroups] = useState<string[]>(defaultOpen);

  function toggleGroup(label: string) {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  }

  return (
    <nav style={{ padding: "4px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
      {NAV_ITEMS.map((item) => {
        if (item.type === "item") {
          const active = selectedKey === item.key;
          const btn = (
            <NavBtn
              icon={item.icon} label={item.label} active={active} collapsed={collapsed}
              onClick={() => { router.push(item.key); onNavigate?.(); }}
            />
          );
          return collapsed ? (
            <Tooltip key={item.key} title={item.label} placement="right">{btn}</Tooltip>
          ) : (
            <div key={item.key}>{btn}</div>
          );
        }

        // group
        const isGroupActive = item.children.some((c) => selectedKey === c.key);
        const isOpen = openGroups.includes(item.label);

        if (collapsed) {
          return item.children.map((child) => {
            const active = selectedKey === child.key;
            return (
              <Tooltip key={child.key} title={child.label} placement="right">
                <NavBtn
                  icon={child.icon} label={child.label} active={active} collapsed
                  onClick={() => { router.push(child.key); onNavigate?.(); }}
                />
              </Tooltip>
            );
          });
        }

        return (
          <div key={item.label}>
            {/* 그룹 헤더 */}
            <button
              onClick={() => toggleGroup(item.label)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 12px",
                height: 52,
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: isGroupActive ? 600 : 500,
                color: isGroupActive ? "#3182F6" : token.colorTextSecondary,
                background: "transparent",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = token.colorFillAlter; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: 18, color: isGroupActive ? "#3182F6" : token.colorTextSecondary, display: "flex", alignItems: "center", flexShrink: 0 }}>
                {item.icon}
              </span>
              <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
              <DownOutlined
                style={{
                  fontSize: 11,
                  color: token.colorTextSecondary,
                  transition: "transform 0.2s",
                  transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                }}
              />
            </button>

            {/* 자식 항목 */}
            {isOpen && (
              <div style={{ overflow: "hidden" }}>
                {item.children.map((child) => (
                  <NavBtn
                    key={child.key}
                    icon={child.icon} label={child.label}
                    active={selectedKey === child.key}
                    indent
                    onClick={() => { router.push(child.key); onNavigate?.(); }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token } = theme.useToken();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [siderCollapsed, setSiderCollapsed] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        style={{
          padding: siderCollapsed ? "20px 18px 16px" : "20px 20px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          marginBottom: 6,
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, #3182F6 0%, #1248c7 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 2px 10px rgba(49,130,246,0.45)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="7.5" cy="10" r="3.6" stroke="white" strokeWidth="1.75"/>
            <line x1="10.4" y1="10" x2="18" y2="10" stroke="white" strokeWidth="1.75" strokeLinecap="round"/>
            <line x1="15.2" y1="10" x2="15.2" y2="12.5" stroke="white" strokeWidth="1.75" strokeLinecap="round"/>
            <line x1="17.4" y1="10" x2="17.4" y2="11.8" stroke="white" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Wordmark */}
        {!siderCollapsed && (
          <div style={{ lineHeight: 1 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: "-0.4px",
                color: token.colorText,
              }}
            >
              License<span style={{ color: "#3182F6" }}>OS</span>
            </div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 500,
                color: token.colorTextSecondary,
                marginTop: 3,
                letterSpacing: "0.4px",
                textTransform: "uppercase",
              }}
            >
              Admin Console
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, padding: "4px 0" }}>
        <NavMenu pathname={pathname} onNavigate={() => setDrawerOpen(false)} collapsed={isMobile ? false : siderCollapsed} />
      </div>

      {/* Logout */}
      <div style={{ padding: "8px 10px 20px", borderTop: `1px solid ${token.colorBorderSecondary}` }}>
        {(isMobile || !siderCollapsed) ? (
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 12px",
              height: 52,
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 500,
              color: token.colorTextSecondary,
              background: "transparent",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(240,68,82,0.07)"; (e.currentTarget as HTMLButtonElement).style.color = "#F04452"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = token.colorTextSecondary; }}
          >
            <LogoutOutlined style={{ fontSize: 18 }} />
            <span>로그아웃</span>
          </button>
        ) : (
          <Tooltip title="로그아웃" placement="right">
            <button
              onClick={handleLogout}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 52,
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 16,
                color: token.colorTextSecondary,
                background: "transparent",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(240,68,82,0.07)"; (e.currentTarget as HTMLButtonElement).style.color = "#F04452"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = token.colorTextSecondary; }}
            >
              <LogoutOutlined />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );

  return (
    <Layout style={{ minHeight: "100vh", background: "var(--admin-bg)" }}>
      {/* Desktop Sider */}
      {!isMobile && (
        <Sider
          collapsed={siderCollapsed}
          collapsedWidth={72}
          width={240}
          style={{
            background: "transparent",
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
            overflow: "auto",
          }}
        >
          {sidebarContent}
        </Sider>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          styles={{ body: { padding: 0 }, header: { display: "none" }, wrapper: { width: 260 }, section: { background: "var(--admin-bg)" } }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* Main area */}
      <Layout
        style={{
          marginLeft: isMobile ? 0 : siderCollapsed ? 72 : 240,
          transition: "margin-left 0.2s",
          background: "transparent",
        }}
      >
        {/* Header */}
        <Header
          style={{
            background: "transparent",
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 99,
            height: 56,
          }}
        >
          <Button
            type="text"
            icon={
              isMobile ? (
                <MenuUnfoldOutlined />
              ) : siderCollapsed ? (
                <MenuUnfoldOutlined />
              ) : (
                <MenuFoldOutlined />
              )
            }
            onClick={() =>
              isMobile
                ? setDrawerOpen(true)
                : setSiderCollapsed((c) => !c)
            }
            style={{ width: 36, height: 36, padding: 0 }}
          />
          <ThemeToggle />
        </Header>

        {/* Page Content */}
        <Content
          style={{
            padding: isMobile ? "20px 16px" : "28px 28px",
            maxWidth: 1200,
            width: "100%",
            margin: "0 auto",
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
