"use client";

import { AppstoreOutlined, CheckCircleOutlined, KeyOutlined, LaptopOutlined } from "@ant-design/icons";
import Image from "next/image";
import { Card, Col, Row, Typography, theme } from "antd";
import { useEffect, useState } from "react";
import { licenseApi, programApi, type License, type Program } from "@/lib/api";

const { Title, Text } = Typography;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

export default function DashboardPage() {
  const { token } = theme.useToken();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [allLicenses, setAllLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const progs = await programApi.list();
        setPrograms(progs);
        const licenseArrays = await Promise.all(
          progs.map((p) => licenseApi.list(p.id))
        );
        setAllLicenses(licenseArrays.flat());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const activeLicenses = allLicenses.filter((l) => l.is_active);
  const totalDevices = allLicenses.reduce((sum, l) => sum + l.devices.length, 0);

  const stats = [
    {
      title: "총 프로그램",
      value: programs.length,
      icon: <AppstoreOutlined style={{ color: "#3182F6" }} />,
      color: "rgba(49,130,246,0.08)",
    },
    {
      title: "전체 라이선스",
      value: allLicenses.length,
      icon: <KeyOutlined style={{ color: "#00B448" }} />,
      color: "rgba(0,180,72,0.08)",
    },
    {
      title: "활성 라이선스",
      value: activeLicenses.length,
      icon: <CheckCircleOutlined style={{ color: "#3182F6" }} />,
      color: "rgba(49,130,246,0.08)",
    },
    {
      title: "등록 기기 수",
      value: totalDevices,
      icon: <LaptopOutlined style={{ color: "#F7A600" }} />,
      color: "rgba(247,166,0,0.08)",
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
          대시보드
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          전체 라이선스 현황을 한눈에 확인하세요.
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        {stats.map((s) => (
          <Col xs={12} sm={12} md={6} key={s.title}>
            <Card loading={loading} style={{ height: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: s.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {s.icon}
                  </div>
                  <span style={{ fontSize: 12, color: token.colorTextSecondary, whiteSpace: "nowrap" }}>
                    {s.title}
                  </span>
                </div>
                <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: token.colorText }}>
                  {s.value}
                </span>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Program summary */}
      {programs.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <Title level={5} style={{ marginBottom: 16, fontWeight: 700 }}>
            프로그램별 현황
          </Title>
          <Row gutter={[16, 16]}>
            {programs.map((p) => {
              const licenses = allLicenses.filter((l) => l.program_id === p.id);
              const active = licenses.filter((l) => l.is_active).length;
              const inactive = licenses.length - active;
              const activeRatio = licenses.length ? (active / licenses.length) * 100 : 0;
              const imgSrc = p.image_url ? `${API_BASE}${p.image_url}` : null;
              return (
                <Col xs={24} sm={12} lg={8} key={p.id}>
                  <Card
                    hoverable
                    onClick={() =>
                      (window.location.href = `/admin/programs/${p.id}`)
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      {/* 텍스트 + 통계 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ fontSize: 15 }}>
                          {p.name}
                        </Text>
                        {p.description && (
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {p.description}
                            </Text>
                          </div>
                        )}
                        <div style={{ marginTop: 14 }}>
                          {/* 활성 비율 바 */}
                          <div style={{ height: 4, borderRadius: 99, background: token.colorFillSecondary, marginBottom: 10, overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 99, background: "#00B448", width: `${activeRatio}%`, transition: "width 0.4s ease" }} />
                          </div>
                          {/* 인라인 통계 */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap" }}>
                            <span style={{ display: "flex", alignItems: "baseline", gap: 3, whiteSpace: "nowrap" }}>
                              <Text strong style={{ fontSize: 15 }}>{licenses.length}</Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>전체</Text>
                            </span>
                            <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>·</Text>
                            <span style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#00B448", flexShrink: 0, display: "inline-block" }} />
                              <Text strong style={{ fontSize: 15, color: "#00B448" }}>{active}</Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>활성</Text>
                            </span>
                            <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>·</Text>
                            <span style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#8B95A1", flexShrink: 0, display: "inline-block" }} />
                              <Text strong style={{ fontSize: 15, color: "#8B95A1" }}>{inactive}</Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>비활성</Text>
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* 우측 이미지 — 652:488 비율 */}
                      {imgSrc && (
                        <div
                          style={{
                            flexShrink: 0,
                            position: "relative",
                            width: 110,
                            height: Math.round(110 * 488 / 652),
                            borderRadius: 8,
                            overflow: "hidden",
                          }}
                        >
                          <Image
                            src={imgSrc}
                            alt={p.name}
                            fill
                            unoptimized
                            style={{ objectFit: "cover" }}
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </div>
      )}
    </div>
  );
}
