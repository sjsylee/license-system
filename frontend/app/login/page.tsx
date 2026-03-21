"use client";

import { Alert, Button, Card, Form, Input, Typography, theme } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authApi } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";

const { Title, Text } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: { username: string; password: string }) {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi.login(values.username, values.password);
      setAccessToken(data.access_token);
      router.push("/admin");
    } catch {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: token.colorBgLayout, position: "relative", overflow: "hidden" }}
    >
      <style>{`
        @keyframes orb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(60px, -80px) scale(1.08); }
          66% { transform: translate(-40px, 50px) scale(0.95); }
        }
        @keyframes orb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-70px, 60px) scale(0.92); }
          66% { transform: translate(50px, -40px) scale(1.06); }
        }
        @keyframes orb3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, 70px) scale(1.1); }
        }
      `}</style>

      {/* 배경 orb 1 — 좌상단 */}
      <div style={{
        position: "absolute", top: "-10%", left: "-5%",
        width: 480, height: 480,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(49,130,246,0.28) 0%, transparent 70%)",
        filter: "blur(40px)",
        animation: "orb1 14s ease-in-out infinite",
        willChange: "transform",
        pointerEvents: "none",
      }} />

      {/* 배경 orb 2 — 우하단 */}
      <div style={{
        position: "absolute", bottom: "-15%", right: "-8%",
        width: 520, height: 520,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(18,72,199,0.22) 0%, transparent 70%)",
        filter: "blur(50px)",
        animation: "orb2 18s ease-in-out infinite",
        willChange: "transform",
        pointerEvents: "none",
      }} />

      {/* 배경 orb 3 — 우상단 */}
      <div style={{
        position: "absolute", top: "20%", right: "10%",
        width: 300, height: 300,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,160,255,0.18) 0%, transparent 70%)",
        filter: "blur(35px)",
        animation: "orb3 11s ease-in-out infinite",
        willChange: "transform",
        pointerEvents: "none",
      }} />
      <div className="w-full max-w-sm" style={{ position: "relative", zIndex: 1 }}>
        <div className="text-center mb-8">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 13,
                background: "linear-gradient(135deg, #3182F6 0%, #1248c7 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 2px 12px rgba(49,130,246,0.45)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="7.5" cy="10" r="3.6" stroke="white" strokeWidth="1.75"/>
                <line x1="10.4" y1="10" x2="18" y2="10" stroke="white" strokeWidth="1.75" strokeLinecap="round"/>
                <line x1="15.2" y1="10" x2="15.2" y2="12.5" stroke="white" strokeWidth="1.75" strokeLinecap="round"/>
                <line x1="17.4" y1="10" x2="17.4" y2="11.8" stroke="white" strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ lineHeight: 1, textAlign: "left" }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", color: token.colorText }}>
                License<span style={{ color: "#3182F6" }}>OS</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: token.colorTextSecondary, marginTop: 3, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Admin Console
              </div>
            </div>
          </div>
          <Text type="secondary" style={{ fontSize: 14 }}>
            어드민 로그인
          </Text>
        </div>

        <Card>
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              style={{ marginBottom: 20 }}
            />
          )}
          <Form layout="vertical" onFinish={onFinish} size="large">
            <Form.Item
              name="username"
              label="아이디"
              rules={[{ required: true, message: "아이디를 입력하세요" }]}
            >
              <Input placeholder="admin" autoComplete="username" />
            </Form.Item>
            <Form.Item
              name="password"
              label="비밀번호"
              rules={[{ required: true, message: "비밀번호를 입력하세요" }]}
              style={{ marginBottom: 24 }}
            >
              <Input.Password
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              style={{ height: 48, fontWeight: 600, fontSize: 15 }}
            >
              로그인
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
