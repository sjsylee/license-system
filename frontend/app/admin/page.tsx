"use client";

import { AppstoreOutlined, CheckCircleOutlined, KeyOutlined, LaptopOutlined } from "@ant-design/icons";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Badge, Card, Col, Row, Tag, Typography, theme } from "antd";
import { useEffect, useState } from "react";
import { loadAdminDashboardReadModel, type AdminDashboardReadModel } from "@/lib/admin-dashboard";
import { formatKST } from "@/lib/utils";

const { Title, Text } = Typography;

export default function DashboardPage() {
  const router = useRouter();
  const { token } = theme.useToken();
  const [dashboard, setDashboard] = useState<AdminDashboardReadModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setDashboard(await loadAdminDashboardReadModel());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const overview = dashboard?.overview ?? {
    totalPrograms: 0,
    totalLicenses: 0,
    activeLicenses: 0,
    totalDevices: 0,
  };
  const recentDevices = dashboard?.recentDevices ?? [];
  const todayLicenses = dashboard?.todayLicenses ?? [];
  const expiringLicenses = dashboard?.expiringLicenses ?? [];
  const programSummaries = dashboard?.programSummaries ?? [];

  const stats = [
    {
      title: "총 프로그램",
      value: overview.totalPrograms,
      icon: <AppstoreOutlined style={{ color: "#3182F6" }} />,
      color: "rgba(49,130,246,0.08)",
    },
    {
      title: "전체 라이선스",
      value: overview.totalLicenses,
      icon: <KeyOutlined style={{ color: "#00B448" }} />,
      color: "rgba(0,180,72,0.08)",
    },
    {
      title: "활성 라이선스",
      value: overview.activeLicenses,
      icon: <CheckCircleOutlined style={{ color: "#3182F6" }} />,
      color: "rgba(49,130,246,0.08)",
      href: "/admin/active-licenses",
    },
    {
      title: "등록 기기 수",
      value: overview.totalDevices,
      icon: <LaptopOutlined style={{ color: "#F7A600" }} />,
      color: "rgba(247,166,0,0.08)",
      href: "/admin/registered-devices",
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
            <Card
              loading={loading}
              className="glass-card"
              hoverable={Boolean(s.href)}
              onClick={s.href ? () => router.push(s.href) : undefined}
              style={{ height: "100%", cursor: s.href ? "pointer" : "default" }}
            >
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
              className="glass-card"
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
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>{item.username}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>{formatKST(item.last_seen_at, true)}</Text>
                        </div>
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
              className="glass-card"
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
                          <Text strong style={{ fontSize: 13 }}>{item.username}</Text>
                          <Tag color="green" style={{ fontSize: 11, margin: 0 }}>{item.program_name}</Tag>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <Text code style={{ fontSize: 11 }}>{item.license_key}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>{formatKST(item.created_at, true)}</Text>
                        </div>
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
              className="glass-card"
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
      {programSummaries.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <Title level={5} style={{ marginBottom: 16, fontWeight: 700 }}>
            프로그램별 현황
          </Title>
          <Row gutter={[16, 16]}>
            {programSummaries.map((program) => {
              return (
                <Col xs={24} sm={12} lg={8} key={program.id}>
                  <Card
                    hoverable
                    onClick={() =>
                      (window.location.href = `/admin/programs/${program.id}`)
                    }
                    className="glass-card"
                    style={{ cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ fontSize: 15 }}>
                          {program.name}
                        </Text>
                        {program.description && (
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {program.description}
                            </Text>
                          </div>
                        )}
                        <div style={{ marginTop: 14 }}>
                          <div style={{ height: 4, borderRadius: 99, background: token.colorFillSecondary, marginBottom: 10, overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 99, background: "#00B448", width: `${program.activeRatio}%`, transition: "width 0.4s ease" }} />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap" }}>
                            <span style={{ display: "flex", alignItems: "baseline", gap: 3, whiteSpace: "nowrap" }}>
                              <Text strong style={{ fontSize: 15 }}>{program.licenseCount}</Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>전체</Text>
                            </span>
                            <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>·</Text>
                            <span style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#00B448", flexShrink: 0, display: "inline-block" }} />
                              <Text strong style={{ fontSize: 15, color: "#00B448" }}>{program.activeLicenseCount}</Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>활성</Text>
                            </span>
                            <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>·</Text>
                            <span style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#8B95A1", flexShrink: 0, display: "inline-block" }} />
                              <Text strong style={{ fontSize: 15, color: "#8B95A1" }}>{program.inactiveLicenseCount}</Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>비활성</Text>
                            </span>
                          </div>
                        </div>
                      </div>
                      {program.imageSrc && (
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
                            src={program.imageSrc}
                            alt={program.name}
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
