"use client";

import { ArrowLeftOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Button, Card, Input, Select, Table, Typography, theme } from "antd";
import type { TableProps } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import EmptyLottie from "@/components/EmptyLottie";
import {
  getRegisteredDashboardDevices,
  loadDashboardLicenses,
  type DashboardDevice,
} from "@/lib/admin-dashboard";
import { formatKST, parseBackendDate } from "@/lib/utils";

const { Title, Text } = Typography;

type SortKey = "newest" | "oldest";

function getDeviceLabel(device: DashboardDevice) {
  return device.device_name || device.hwid.slice(0, 8);
}

export default function RegisteredDevicesPage() {
  const router = useRouter();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [devices, setDevices] = useState<DashboardDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const dashboardLicenses = await loadDashboardLicenses();
        setDevices(getRegisteredDashboardDevices(dashboardLicenses));
      } catch (error) {
        message.error(error instanceof Error ? error.message : "등록 기기 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [message]);

  const filteredDevices = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const searched = normalizedQuery
      ? devices.filter((device) => device.username.toLowerCase().includes(normalizedQuery))
      : devices;

    return [...searched].sort((left, right) => {
      const leftTime = parseBackendDate(left.activated_at)?.getTime() ?? 0;
      const rightTime = parseBackendDate(right.activated_at)?.getTime() ?? 0;
      return sortKey === "newest" ? rightTime - leftTime : leftTime - rightTime;
    });
  }, [devices, searchQuery, sortKey]);

  const columns: TableProps<DashboardDevice>["columns"] = [
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
      render: (value: string) => <Text>{value}</Text>,
    },
    {
      title: "기기 이름",
      key: "device_name",
      width: 180,
      render: (_value: unknown, device: DashboardDevice) => (
        <Text strong ellipsis={{ tooltip: getDeviceLabel(device) }}>
          {getDeviceLabel(device)}
        </Text>
      ),
    },
    {
      title: "HWID",
      dataIndex: "hwid",
      key: "hwid",
      width: 240,
      render: (value: string) => (
        <Text code style={{ fontSize: 11 }} ellipsis={{ tooltip: value }}>
          {value}
        </Text>
      ),
    },
    {
      title: "등록일",
      dataIndex: "activated_at",
      key: "activated_at",
      width: 160,
      render: (value: string) => <Text style={{ whiteSpace: "nowrap" }}>{formatKST(value, true)}</Text>,
    },
    {
      title: "마지막 접속",
      dataIndex: "last_seen_at",
      key: "last_seen_at",
      width: 160,
      render: (value: string) => <Text style={{ whiteSpace: "nowrap" }}>{formatKST(value, true)}</Text>,
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
          등록 기기 수
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          대시보드 카드와 동일하게, 관리자 계정을 제외한 라이선스에 연결된 모든 기기를 납작한 행으로 보여줍니다.
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
        {!loading && filteredDevices.length === 0 ? (
          <EmptyLottie description={searchQuery ? "검색 결과가 없습니다." : "등록된 기기가 없습니다."} />
        ) : (
          <Table
            dataSource={filteredDevices}
            columns={columns}
            rowKey="key"
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 980 }}
          />
        )}
      </Card>
    </div>
  );
}
