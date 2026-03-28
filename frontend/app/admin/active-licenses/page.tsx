"use client";

import { ArrowLeftOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Button, Card, Input, Select, Table, Tag, Typography, theme } from "antd";
import type { TableProps } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import EmptyLottie from "@/components/EmptyLottie";
import {
  getActiveDashboardLicenses,
  loadDashboardLicenses,
  type DashboardLicense,
} from "@/lib/admin-dashboard";
import { formatKST, parseBackendDate } from "@/lib/utils";

const { Title, Text } = Typography;

type SortKey = "newest" | "oldest";

function renderLicenseExpiry(license: DashboardLicense) {
  if (!license.expires_at) {
    return <Tag color="blue" style={{ margin: 0 }}>활성 · 무기한</Tag>;
  }

  const expiresAt = parseBackendDate(license.expires_at);
  if (!expiresAt) {
    return <Text type="secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>-</Text>;
  }

  const isExpired = expiresAt.getTime() < Date.now();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Text style={{ fontSize: 13, whiteSpace: "nowrap" }}>{formatKST(license.expires_at)}</Text>
      <Tag color={isExpired ? "red" : "green"} style={{ margin: 0, width: "fit-content" }}>
        {isExpired ? "활성 · 만료됨" : "활성"}
      </Tag>
    </div>
  );
}

export default function ActiveLicensesPage() {
  const router = useRouter();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [licenses, setLicenses] = useState<DashboardLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const dashboardLicenses = await loadDashboardLicenses();
        setLicenses(getActiveDashboardLicenses(dashboardLicenses));
      } catch (error) {
        message.error(error instanceof Error ? error.message : "활성 라이선스를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [message]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const filteredLicenses = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const searched = normalizedQuery
      ? licenses.filter((license) => license.username.toLowerCase().includes(normalizedQuery))
      : licenses;

    return [...searched].sort((left, right) => {
      const leftTime = parseBackendDate(left.created_at)?.getTime() ?? 0;
      const rightTime = parseBackendDate(right.created_at)?.getTime() ?? 0;
      return sortKey === "newest" ? rightTime - leftTime : leftTime - rightTime;
    });
  }, [licenses, searchQuery, sortKey]);

  const columns: TableProps<DashboardLicense>["columns"] = [
    {
      title: "사용자",
      dataIndex: "username",
      key: "username",
      width: 140,
      render: (value: string) => <Text strong style={{ whiteSpace: "nowrap" }}>{value}</Text>,
    },
    {
      title: "프로그램",
      dataIndex: "programName",
      key: "programName",
      width: 160,
      render: (value: string) => <Tag color="blue" style={{ margin: 0 }}>{value}</Tag>,
    },
    {
      title: "라이선스 키",
      dataIndex: "license_key",
      key: "license_key",
      width: 240,
      render: (value: string) => (
        <Text code style={{ fontSize: 11, letterSpacing: "0.02em" }} ellipsis={{ tooltip: value }}>
          {value}
        </Text>
      ),
    },
    {
      title: "등록일",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (value: string) => <Text style={{ whiteSpace: "nowrap" }}>{formatKST(value, true)}</Text>,
    },
    {
      title: "만료일 / 상태",
      key: "expires_at",
      width: 170,
      render: (_value: unknown, license: DashboardLicense) => renderLicenseExpiry(license),
    },
    {
      title: "기기",
      key: "devices",
      width: 90,
      render: (_value: unknown, license: DashboardLicense) => (
        <Text style={{ whiteSpace: "nowrap" }}>{license.devices.length}/{license.max_devices}</Text>
      ),
    },
  ];

  const mobileColumns: TableProps<DashboardLicense>["columns"] = [
    {
      key: "info",
      render: (_value: unknown, license: DashboardLicense) => (
        <div style={{ padding: "4px 0" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 6,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Text strong style={{ fontSize: 14, display: "block" }}>{license.username}</Text>
              <Tag color="blue" style={{ margin: "4px 0 0" }}>{license.programName}</Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
              {formatKST(license.created_at, true)}
            </Text>
          </div>
          <div style={{ marginBottom: 8 }}>
            <Text code style={{ fontSize: 11 }} ellipsis={{ tooltip: license.license_key }}>
              {license.license_key}
            </Text>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {renderLicenseExpiry(license)}
            <Text type="secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
              {license.devices.length}/{license.max_devices}기기
            </Text>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/admin")}
          style={{ padding: "0 4px", marginBottom: 12, color: token.colorTextSecondary }}
        >
          대시보드
        </Button>
        <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
          활성 라이선스
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          현재 활성화된 라이선스를 확인하세요.
        </Text>
      </div>

      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Input
          prefix={<SearchOutlined style={{ color: token.colorTextSecondary }} />}
          placeholder="사용자 이름으로 검색"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          allowClear
          style={{ maxWidth: 280 }}
        />
        <Select
          value={sortKey}
          onChange={setSortKey}
          style={{ width: 160 }}
          options={[
            { value: "newest", label: "최신 등록순" },
            { value: "oldest", label: "오래된 등록순" },
          ]}
        />
      </div>

      <Card>
        {!loading && filteredLicenses.length === 0 ? (
          <EmptyLottie description={searchQuery ? "검색 결과가 없습니다." : "활성 라이선스가 없습니다."} />
        ) : (
          <Table
            dataSource={filteredLicenses}
            columns={isMobile ? mobileColumns : columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={isMobile ? undefined : { x: 880 }}
            showHeader={!isMobile}
          />
        )}
      </Card>
    </div>
  );
}
