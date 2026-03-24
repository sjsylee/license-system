"use client";

import { AppstoreOutlined, CheckCircleOutlined, KeyOutlined, LaptopOutlined } from "@ant-design/icons";
import Image from "next/image";
import { Badge, Card, Col, Row, Tag, Typography, theme } from "antd";
import { useEffect, useState } from "react";
import { licenseApi, programApi, type License, type Program } from "@/lib/api";
import { daysUntil, formatKST, isToday, parseBackendDate } from "@/lib/utils";

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

  const programMap = Object.fromEntries(programs.map((p) => [p.id, p.name]));

  const recentDevices = allLicenses
    .flatMap((l) =>
      l.devices.map((d) => ({
        device_name: d.device_name || d.hwid.slice(0, 8),
        program_name: programMap[l.program_id] || "",
        last_seen_at: d.last_seen_at,
      }))
    )
    .filter((d) => d.last_seen_at)
    .sort((a, b) => {
      const bTime = parseBackendDate(b.last_seen_at)?.getTime() ?? 0;
      const aTime = parseBackendDate(a.last_seen_at)?.getTime() ?? 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  const todayLicenses = allLicenses
    .filter((l) => isToday(l.created_at))
    .sort((a, b) => {
      const bTime = parseBackendDate(b.created_at)?.getTime() ?? 0;
      const aTime = parseBackendDate(a.created_at)?.getTime() ?? 0;
      return bTime - aTime;
    })
    .slice(0, 5)
    .map((l) => ({
      license_key: l.license_key,
      program_name: programMap[l.program_id] || "",
      created_at: l.created_at,
    }));

  const expiringLicenses = allLicenses
    .filter((l) => l.is_active && l.expires_at && daysUntil(l.expires_at) <= 3)
    .map((l) => ({
      username: l.username,
      program_name: programMap[l.program_id] || "",
      expires_at: l.expires_at!,
      days: daysUntil(l.expires_at!),
    }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

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

      {/* Activity widgets */}
      <div style={{ marginTop: 24 }}>
        <Row gutter={[16, 16]}>
          {/* 최근 접속 PC */}
          <Col xs={24} md={8}>
            <Card
              loading={loading}
              title="최근 접속 PC"
              extra={<Badge count={recentDevices.length} color="#3182F6" />}
              style={{ height: "100%" }}
              styles={{ body: { padding: "8px 16px" } }}
            >
              {recentDevices.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 13 }}>접속 기록 없음</Text>
              ) : (
                <div>
                  {recentDevices.map((item, index) => (
                    <div
                      key={`${item.device_name}-${item.last_seen_at}-${index}`}
                      style={{
                        padding: "8px 0",
                        borderBottom:
                          index === recentDevices.length - 1
                            ? "none"
                            : `1px solid ${token.colorBorderSecondary}`,
                      }}
                    >
                      <div style={{ width: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Text strong style={{ fontSize: 13 }}>{item.device_name}</Text>
                          <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>{item.program_name}</Tag>
                        </div>
                        <Text type="secondary" style={{ fontSize: 11 }}>{formatKST(item.last_seen_at, true)}</Text>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>

          {/* 금일 등록 라이선스 */}
          <Col xs={24} md={8}>
            <Card
              loading={loading}
              title="금일 등록 라이선스"
              extra={<Badge count={todayLicenses.length} color="#00B448" />}
              style={{ height: "100%" }}
              styles={{ body: { padding: "8px 16px" } }}
            >
              {todayLicenses.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 13 }}>오늘 등록된 라이선스 없음</Text>
              ) : (
                <div>
                  {todayLicenses.map((item, index) => (
                    <div
                      key={`${item.license_key}-${item.created_at}-${index}`}
                      style={{
                        padding: "8px 0",
                        borderBottom:
                          index === todayLicenses.length - 1
                            ? "none"
                            : `1px solid ${token.colorBorderSecondary}`,
                      }}
                    >
                      <div style={{ width: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Text code style={{ fontSize: 11 }}>{item.license_key}</Text>
                          <Tag color="green" style={{ fontSize: 11, margin: 0 }}>{item.program_name}</Tag>
                        </div>
                        <Text type="secondary" style={{ fontSize: 11 }}>{formatKST(item.created_at, true)}</Text>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>

          {/* 만료 임박 */}
          <Col xs={24} md={8}>
            <Card
              loading={loading}
              title="만료 임박 (3일 이내)"
              extra={<Badge count={expiringLicenses.length} color="#F7A600" />}
              style={{ height: "100%" }}
              styles={{ body: { padding: "8px 16px" } }}
            >
              {expiringLicenses.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 13 }}>만료 임박 라이선스 없음</Text>
              ) : (
                <div>
                  {expiringLicenses.map((item, index) => (
                    <div
                      key={`${item.username}-${item.expires_at}-${index}`}
                      style={{
                        padding: "8px 0",
                        borderBottom:
                          index === expiringLicenses.length - 1
                            ? "none"
                            : `1px solid ${token.colorBorderSecondary}`,
                      }}
                    >
                      <div style={{ width: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Text strong style={{ fontSize: 13 }}>{item.username}</Text>
                          <Tag color={item.days <= 0 ? "red" : item.days === 1 ? "orange" : "gold"} style={{ fontSize: 11, margin: 0 }}>
                            {item.days <= 0 ? "오늘 만료" : `D-${item.days}`}
                          </Tag>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>{item.program_name}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>{formatKST(item.expires_at)}</Text>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </div>

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
                          <div style={{ height: 4, borderRadius: 99, background: token.colorFillSecondary, marginBottom: 10, overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 99, background: "#00B448", width: `${activeRatio}%`, transition: "width 0.4s ease" }} />
                          </div>
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
