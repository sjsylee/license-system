"use client";

import {
  ArrowLeftOutlined, CalendarOutlined, CopyOutlined, DeleteOutlined,
  EditOutlined, GithubOutlined, LaptopOutlined, MailOutlined,
  PhoneOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, TableOutlined, UserOutlined,
} from "@ant-design/icons";
import {
  App, Badge, Button, Card, Col, DatePicker, Form, Input, InputNumber,
  Modal, Popconfirm, Row, Select, Space, Switch, Table, Tag,
  Tooltip, Typography, theme,
} from "antd";
import dayjs from "dayjs";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import EmptyLottie from "@/components/EmptyLottie";
import { licenseApi, programApi, type License, type Program } from "@/lib/api";
import { daysUntil, formatKST, parseBackendDate } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

const { Title, Text } = Typography;

const GITHUB_OWNER = process.env.NEXT_PUBLIC_GITHUB_OWNER ?? "";

const QUICK_DATES = [
  { label: "1주일", amount: 7, unit: "day" as const },
  { label: "1개월", amount: 1, unit: "month" as const },
  { label: "3개월", amount: 3, unit: "month" as const },
  { label: "6개월", amount: 6, unit: "month" as const },
];

const noWrap = { style: { whiteSpace: "nowrap" as const } };

type FilterKey = "all" | "active" | "inactive" | "expired";

function isExpired(license: License) {
  if (!license.expires_at) return false;
  const expiresAt = parseBackendDate(license.expires_at);
  if (!expiresAt) return false;
  return dayjs(expiresAt).isBefore(dayjs());
}

function RemainingDays({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return <Tag color="blue" style={{ margin: 0 }}>무기한</Tag>;

  const expiresDate = parseBackendDate(expiresAt);
  if (!expiresDate) {
    return <Text type="secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>-</Text>;
  }

  const diff = daysUntil(expiresAt);
  if (dayjs(expiresDate).isBefore(dayjs())) {
    return <Text type="danger" style={{ fontSize: 12, whiteSpace: "nowrap" }}>만료됨</Text>;
  }
  if (diff === 0) {
    return (
      <Space size={4} orientation="vertical" style={{ lineHeight: 1.3 }}>
        <Text style={{ fontSize: 13, whiteSpace: "nowrap" }}>{formatKST(expiresAt)}</Text>
        <Text type="danger" style={{ fontSize: 11, whiteSpace: "nowrap" }}>오늘 만료</Text>
      </Space>
    );
  }
  return (
    <Space size={4} orientation="vertical" style={{ lineHeight: 1.3 }}>
      <Text style={{ fontSize: 13, whiteSpace: "nowrap" }}>{formatKST(expiresAt)}</Text>
      <Text type="secondary" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
        {diff <= 30
          ? <span style={{ color: diff <= 7 ? "#ff4d4f" : "#fa8c16" }}>D-{diff}</span>
          : `${diff}일 남음`}
      </Text>
    </Space>
  );
}

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const programId = Number(id);

  const [program, setProgram] = useState<Program | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailLicense, setDetailLicense] = useState<License | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterKey, setFilterKey] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [extendTarget, setExtendTarget] = useState<License | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [editingMaxDevices, setEditingMaxDevices] = useState<number | null>(null);
  const [contactTarget, setContactTarget] = useState<License | null>(null);
  const [sortKey, setSortKey] = useState<"newest" | "expiry_asc">("newest");
  const [metaTarget, setMetaTarget] = useState<License | null>(null);
  const [form] = Form.useForm();
  const [extendForm] = Form.useForm();
  const [contactForm] = Form.useForm();

  async function load() {
    try {
      const [prog, lics] = await Promise.all([
        programApi.get(programId),
        licenseApi.list(programId),
      ]);
      setProgram(prog);
      setLicenses(lics);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [programId]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const stats = useMemo(() => ({
    all: licenses.length,
    active: licenses.filter((l) => l.is_active && !isExpired(l)).length,
    inactive: licenses.filter((l) => !l.is_active).length,
    expired: licenses.filter(isExpired).length,
  }), [licenses]);

  const filtered = useMemo(() => {
    let base = licenses;
    if (filterKey === "active") base = licenses.filter((l) => l.is_active && !isExpired(l));
    else if (filterKey === "inactive") base = licenses.filter((l) => !l.is_active);
    else if (filterKey === "expired") base = licenses.filter(isExpired);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      base = base.filter((l) => l.username.toLowerCase().includes(q));
    }
    return [...base].sort((a, b) => {
      if (sortKey === "newest") {
        const bTime = parseBackendDate(b.created_at)?.getTime() ?? 0;
        const aTime = parseBackendDate(a.created_at)?.getTime() ?? 0;
        return bTime - aTime;
      }
      // expiry_asc: 무기한은 맨 뒤, 만료일 짧은 순
      if (!a.expires_at && !b.expires_at) return 0;
      if (!a.expires_at) return 1;
      if (!b.expires_at) return -1;
      const aTime = parseBackendDate(a.expires_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = parseBackendDate(b.expires_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  }, [licenses, filterKey, searchQuery, sortKey]);

  async function handleCreate(values: any) {
    setSubmitting(true);
    try {
      const meta = program?.meta_schemas.map((s) => ({
        schema_id: s.id,
        value: String(values[`meta_${s.id}`] ?? s.default_value ?? ""),
      })).filter((m) => m.value !== "");

      await licenseApi.create({
        program_id: programId,
        username: values.username,
        expires_at: values.expires_at
          ? dayjs(values.expires_at).toISOString()
          : null,
        max_devices: values.max_devices ?? 3,
        meta,
        user_id: values.user_id || null,
        email: values.email || null,
        phone: values.phone || null,
      });
      message.success("라이선스가 발급되었습니다.");
      setCreateOpen(false);
      form.resetFields();
      load();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(license: License) {
    try {
      await licenseApi.update(license.id, { is_active: !license.is_active });
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  async function handleDelete(id: number) {
    try {
      await licenseApi.delete(id);
      message.success("삭제되었습니다.");
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  async function handleUpdateMaxDevices() {
    if (!detailLicense || editingMaxDevices === null) return;
    try {
      await licenseApi.update(detailLicense.id, { max_devices: editingMaxDevices });
      setDetailLicense({ ...detailLicense, max_devices: editingMaxDevices });
      setEditingMaxDevices(null);
      load();
      message.success("허용 기기 수가 변경되었습니다.");
    } catch (e: any) {
      message.error(e.message);
    }
  }

  async function handleExtend(values: any) {
    if (!extendTarget) return;
    setSubmitting(true);
    try {
      await licenseApi.update(extendTarget.id, {
        expires_at: values.extends_at ? dayjs(values.extends_at).toISOString() : null,
      });
      message.success("만료일이 연장되었습니다.");
      setExtendTarget(null);
      extendForm.resetFields();
      load();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateContact(values: any) {
    if (!contactTarget) return;
    setSubmitting(true);
    try {
      await licenseApi.update(contactTarget.id, {
        user_id: values.user_id || null,
        email: values.email || null,
        phone: values.phone || null,
      });
      message.success("연락처가 수정되었습니다.");
      setContactTarget(null);
      contactForm.resetFields();
      load();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveDevice(licenseId: number, hwid: string) {
    try {
      await licenseApi.removeDevice(licenseId, hwid);
      message.success("기기 등록이 해제되었습니다.");
      if (detailLicense) {
        const updated = await licenseApi.get(licenseId);
        setDetailLicense(updated);
        load();
      }
    } catch (e: any) {
      message.error(e.message);
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    message.success("복사되었습니다.");
  }

  function setQuickDate(amount: number, unit: "day" | "month") {
    form.setFieldValue("expires_at", dayjs().add(amount, unit));
  }

  const columns = [
    {
      title: "사용자",
      dataIndex: "username",
      key: "username",
      width: 120,
      render: (_: string, r: License) => (
        <div style={{ whiteSpace: "nowrap" }}>
          <Text strong style={{ display: "block" }}>{r.username}</Text>
          {r.user_id && (
            <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
              <UserOutlined style={{ marginRight: 3 }} />{r.user_id}
            </Text>
          )}
          {r.email && (
            <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
              <MailOutlined style={{ marginRight: 3 }} />{r.email}
            </Text>
          )}
          {r.phone && (
            <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
              <PhoneOutlined style={{ marginRight: 3 }} />{r.phone}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "라이선스 키",
      dataIndex: "license_key",
      key: "license_key",
      width: 220,
      render: (key: string) => (
        <Space size={4} style={{ flexWrap: "nowrap" }}>
          <Text
            code
            style={{ fontSize: 11, letterSpacing: "0.02em", whiteSpace: "nowrap" }}
            ellipsis={{ tooltip: key }}
          >
            {key.slice(0, 19)}…
          </Text>
          <Tooltip title="복사">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyKey(key)}
              style={{ padding: "0 4px", flexShrink: 0 }}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: "만료일",
      dataIndex: "expires_at",
      key: "expires_at",
      width: 110,
      responsive: ["md"] as any,
      onHeaderCell: () => noWrap,
      render: (v: string | null) => <RemainingDays expiresAt={v} />,
    },
    {
      title: "기기",
      key: "devices",
      width: 64,
      responsive: ["sm"] as any,
      onCell: () => noWrap,
      onHeaderCell: () => noWrap,
      render: (_: any, r: License) => (
        <Text style={{ fontSize: 13, whiteSpace: "nowrap" }}>
          {r.devices.length}/{r.max_devices}
        </Text>
      ),
    },
    {
      title: "상태",
      key: "is_active",
      width: 60,
      onHeaderCell: () => noWrap,
      render: (_: any, r: License) => {
        const expired = isExpired(r);
        return (
          <Tooltip title={expired ? "만료된 라이선스입니다. 만료일 연장 후 활성화 가능합니다." : undefined}>
            <Switch
              checked={r.is_active && !expired}
              onChange={() => handleToggleActive(r)}
              size="small"
              disabled={expired}
            />
          </Tooltip>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 112,
      render: (_: any, r: License) => (
        <Space size={4}>
          <Tooltip title="연락처 수정">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setContactTarget(r);
                contactForm.setFieldsValue({ user_id: r.user_id ?? "", email: r.email ?? "", phone: r.phone ?? "" });
              }}
              style={{ width: 32, height: 32, padding: 0 }}
            />
          </Tooltip>
          <Tooltip title="만료일 연장">
            <Button
              type="text"
              icon={<CalendarOutlined />}
              onClick={() => {
                setExtendTarget(r);
                extendForm.setFieldValue("extends_at", r.expires_at ? dayjs(r.expires_at) : null);
              }}
              style={{ width: 32, height: 32, padding: 0 }}
            />
          </Tooltip>
          <Button
            type="text"
            icon={<LaptopOutlined />}
            onClick={() => setDetailLicense(r)}
            style={{ width: 32, height: 32, padding: 0 }}
          />
          {(program?.meta_schemas.length ?? 0) > 0 && (
            <Tooltip title="메타 데이터">
              <Button
                type="text"
                icon={<TableOutlined />}
                onClick={() => setMetaTarget(r)}
                style={{ width: 32, height: 32, padding: 0 }}
                disabled={r.meta.length === 0}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="라이선스를 삭제하시겠습니까?"
            onConfirm={() => handleDelete(r.id)}
            okText="삭제"
            cancelText="취소"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} style={{ width: 32, height: 32, padding: 0 }} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const mobileColumns = [
    {
      key: "info",
      render: (_: any, r: License) => {
        const expired = isExpired(r);
        return (
          <div style={{ padding: "4px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div>
                <Text strong style={{ fontSize: 14 }}>{r.username}</Text>
                {(r.user_id || r.email || r.phone) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                    {r.user_id && <Text type="secondary" style={{ fontSize: 11 }}><UserOutlined style={{ marginRight: 2 }} />{r.user_id}</Text>}
                    {r.email && <Text type="secondary" style={{ fontSize: 11 }}><MailOutlined style={{ marginRight: 2 }} />{r.email}</Text>}
                    {r.phone && <Text type="secondary" style={{ fontSize: 11 }}><PhoneOutlined style={{ marginRight: 2 }} />{r.phone}</Text>}
                  </div>
                )}
              </div>
              <Tooltip title={expired ? "만료된 라이선스입니다. 만료일 연장 후 활성화 가능합니다." : undefined}>
                <Switch
                  checked={r.is_active && !expired}
                  onChange={() => handleToggleActive(r)}
                  size="small"
                  disabled={expired}
                />
              </Tooltip>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
              <Text code style={{ fontSize: 11 }}>{r.license_key.slice(0, 22)}…</Text>
              <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyKey(r.license_key)} style={{ padding: "0 2px" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Space size={10}>
                <RemainingDays expiresAt={r.expires_at} />
                <Text type="secondary" style={{ fontSize: 12 }}>{r.devices.length}/{r.max_devices}기기</Text>
              </Space>
              <Space size={4}>
                <Tooltip title="연락처 수정">
                  <Button
                    type="text" icon={<EditOutlined />}
                    onClick={() => { setContactTarget(r); contactForm.setFieldsValue({ user_id: r.user_id ?? "", email: r.email ?? "", phone: r.phone ?? "" }); }}
                    style={{ width: 36, height: 36, padding: 0 }}
                  />
                </Tooltip>
                <Tooltip title="만료일 연장">
                  <Button
                    type="text" icon={<CalendarOutlined />}
                    onClick={() => { setExtendTarget(r); extendForm.setFieldValue("extends_at", r.expires_at ? dayjs(r.expires_at) : null); }}
                    style={{ width: 36, height: 36, padding: 0 }}
                  />
                </Tooltip>
                <Button type="text" icon={<LaptopOutlined />} onClick={() => setDetailLicense(r)} style={{ width: 36, height: 36, padding: 0 }} />
                {(program?.meta_schemas.length ?? 0) > 0 && (
                  <Button
                    type="text"
                    icon={<TableOutlined />}
                    onClick={() => setMetaTarget(r)}
                    style={{ width: 36, height: 36, padding: 0 }}
                    disabled={r.meta.length === 0}
                  />
                )}
                <Popconfirm
                  title="라이선스를 삭제하시겠습니까?"
                  onConfirm={() => handleDelete(r.id)}
                  okText="삭제" cancelText="취소" okButtonProps={{ danger: true }}
                >
                  <Button type="text" danger icon={<DeleteOutlined />} style={{ width: 36, height: 36, padding: 0 }} />
                </Popconfirm>
              </Space>
            </div>
          </div>
        );
      },
    },
  ];

  const STAT_ITEMS = [
    { label: "전체", key: "all" as FilterKey, color: "#3182F6" },
    { label: "활성", key: "active" as FilterKey, color: "#00B448" },
    { label: "비활성", key: "inactive" as FilterKey, color: "#8B95A1" },
    { label: "만료", key: "expired" as FilterKey, color: "#ff4d4f" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/admin/programs")}
          style={{ padding: "0 4px", marginBottom: 12, color: token.colorTextSecondary }}
        >
          프로그램 목록
        </Button>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {program?.image_url && (
              <div
                style={{
                  flexShrink: 0,
                  position: "relative",
                  height: 56,
                  width: Math.round(56 * 652 / 488),
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <Image
                  src={`${API_BASE}${program.image_url}`}
                  alt={program.name}
                  fill
                  unoptimized
                  style={{ objectFit: "cover" }}
                />
              </div>
            )}
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
                {program?.name ?? "로딩 중..."}
              </Title>
              {program?.description && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {program.description}
                </Text>
              )}
            </div>
          </div>
          <Space size={8}>
            {GITHUB_OWNER && program && (
              <Tooltip title="GitHub 릴리즈 페이지">
                <Button
                  icon={<GithubOutlined />}
                  onClick={() =>
                    window.open(
                      `https://github.com/${GITHUB_OWNER}/${program.name}_r/releases`,
                      "_blank"
                    )
                  }
                />
              </Tooltip>
            )}
            <Tooltip title="새로고침">
              <Button icon={<ReloadOutlined />} onClick={() => load()} />
            </Tooltip>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
              style={{ fontWeight: 600 }}
            >
              라이선스 발급
            </Button>
          </Space>
        </div>
      </div>

      {/* Stats row — 클릭하면 필터 적용 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        {STAT_ITEMS.map((s) => (
          <Col xs={6} key={s.key}>
            <Card
              size="small"
              style={{
                cursor: "pointer",
                borderColor: filterKey === s.key ? s.color : undefined,
                transition: "border-color 0.2s",
              }}
              onClick={() => setFilterKey(filterKey === s.key ? "all" : s.key)}
            >
              <Text type="secondary" style={{ fontSize: 11 }}>{s.label}</Text>
              <div>
                <Text strong style={{ fontSize: 22, color: s.color }}>{stats[s.key]}</Text>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 사용자 검색 + 정렬 */}
      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Input
          prefix={<SearchOutlined style={{ color: token.colorTextSecondary }} />}
          placeholder="사용자 이름으로 검색"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          style={{ maxWidth: 280 }}
        />
        <Select
          value={sortKey}
          onChange={setSortKey}
          style={{ width: 160 }}
          options={[
            { value: "newest", label: "최신 등록순" },
            { value: "expiry_asc", label: "만료일 짧은 순" },
          ]}
        />
      </div>

      {/* License Table */}
      <Card>
        {filtered.length === 0 && !loading ? (
          <EmptyLottie description={searchQuery ? "검색 결과가 없습니다." : "해당하는 라이선스가 없습니다."} />
        ) : (
          <Table
            dataSource={filtered}
            columns={isMobile ? mobileColumns : columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={isMobile ? undefined : { x: 480 }}
            size="middle"
            showHeader={!isMobile}
          />
        )}
      </Card>

      {/* 라이선스 발급 Modal */}
      <Modal
        title="라이선스 발급"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        footer={null}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item
            name="username"
            label="사용자 이름"
            rules={[{ required: true, message: "이름을 입력하세요" }]}
          >
            <Input placeholder="홍길동" />
          </Form.Item>

          <Form.Item name="user_id" label="사용자 ID (선택)">
            <Input placeholder="내부 사용자 ID" prefix={<UserOutlined style={{ color: token.colorTextSecondary }} />} />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="email" label="이메일 (선택)">
                <Input placeholder="example@email.com" prefix={<MailOutlined style={{ color: token.colorTextSecondary }} />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="전화번호 (선택)">
                <Input placeholder="010-0000-0000" prefix={<PhoneOutlined style={{ color: token.colorTextSecondary }} />} />
              </Form.Item>
            </Col>
          </Row>

          {/* 만료일 + 빠른 선택 버튼 */}
          <Form.Item
            name="expires_at"
            label={
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>만료일</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {QUICK_DATES.map(({ label, amount, unit }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setQuickDate(amount, unit)}
                      style={{
                        padding: "1px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        border: `1px solid ${token.colorPrimary}`,
                        borderRadius: 6,
                        color: token.colorPrimary,
                        background: "transparent",
                        cursor: "pointer",
                        lineHeight: "18px",
                        fontFamily: "inherit",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            <DatePicker
              style={{ width: "100%" }}
              format="YYYY-MM-DD"
              placeholder="미설정 시 무기한"
              disabledDate={(d) => d.isBefore(dayjs(), "day")}
            />
          </Form.Item>

          <Form.Item name="max_devices" label="허용 기기 수" initialValue={3}>
            <InputNumber min={1} max={99} style={{ width: "100%" }} />
          </Form.Item>

          {program && program.meta_schemas.length > 0 && (
            <div
              style={{
                padding: "16px",
                borderRadius: 10,
                background: token.colorFillAlter,
                marginBottom: 16,
              }}
            >
              <Text strong style={{ display: "block", marginBottom: 12, fontSize: 13 }}>
                확장 변수
              </Text>
              {program.meta_schemas.map((s) => (
                <Form.Item
                  key={s.id}
                  name={`meta_${s.id}`}
                  label={
                    <span>
                      {s.key}
                      <Tag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>{s.value_type}</Tag>
                    </span>
                  }
                  initialValue={s.default_value ?? undefined}
                  style={{ marginBottom: 8 }}
                >
                  {s.value_type === "bool" ? (
                    <Select>
                      <Select.Option value="true">true</Select.Option>
                      <Select.Option value="false">false</Select.Option>
                    </Select>
                  ) : (
                    <InputNumber
                      style={{ width: "100%" }}
                      step={s.value_type === "float" ? 0.1 : 1}
                      placeholder={s.default_value ?? undefined}
                    />
                  )}
                </Form.Item>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => { setCreateOpen(false); form.resetFields(); }}>취소</Button>
            <Button type="primary" htmlType="submit" loading={submitting} style={{ fontWeight: 600 }}>
              발급
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 만료일 연장 Modal */}
      <Modal
        title={
          <span>
            만료일 연장
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
              {extendTarget?.username}
            </Text>
          </span>
        }
        open={extendTarget !== null}
        onCancel={() => { setExtendTarget(null); extendForm.resetFields(); }}
        footer={null}
        width={420}
      >
        <Form form={extendForm} layout="vertical" onFinish={handleExtend} style={{ marginTop: 16 }}>
          <Form.Item
            name="extends_at"
            label={
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>새 만료일</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {QUICK_DATES.map(({ label, amount, unit }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                          const base = extendTarget?.expires_at && dayjs(extendTarget.expires_at).isAfter(dayjs())
                            ? dayjs(extendTarget.expires_at)
                            : dayjs();
                          extendForm.setFieldValue("extends_at", base.add(amount, unit));
                        }}
                      style={{
                        padding: "1px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        border: `1px solid ${token.colorPrimary}`,
                        borderRadius: 6,
                        color: token.colorPrimary,
                        background: "transparent",
                        cursor: "pointer",
                        lineHeight: "18px",
                        fontFamily: "inherit",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            }
            rules={[{ required: true, message: "만료일을 선택하세요" }]}
          >
            <DatePicker
              style={{ width: "100%" }}
              format="YYYY-MM-DD"
              placeholder="날짜 선택"
            />
          </Form.Item>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => { setExtendTarget(null); extendForm.resetFields(); }}>취소</Button>
            <Button type="primary" htmlType="submit" loading={submitting} style={{ fontWeight: 600 }}>
              연장
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 연락처 수정 Modal */}
      <Modal
        title={
          <span>
            연락처 수정
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
              {contactTarget?.username}
            </Text>
          </span>
        }
        open={contactTarget !== null}
        onCancel={() => { setContactTarget(null); contactForm.resetFields(); }}
        footer={null}
        width={420}
      >
        <Form form={contactForm} layout="vertical" onFinish={handleUpdateContact} style={{ marginTop: 16 }}>
          <Form.Item name="user_id" label="사용자 ID">
            <Input placeholder="내부 사용자 ID (선택)" prefix={<UserOutlined style={{ color: token.colorTextSecondary }} />} allowClear />
          </Form.Item>
          <Form.Item name="email" label="이메일">
            <Input placeholder="example@email.com (선택)" prefix={<MailOutlined style={{ color: token.colorTextSecondary }} />} allowClear />
          </Form.Item>
          <Form.Item name="phone" label="전화번호">
            <Input placeholder="010-0000-0000 (선택)" prefix={<PhoneOutlined style={{ color: token.colorTextSecondary }} />} allowClear />
          </Form.Item>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => { setContactTarget(null); contactForm.resetFields(); }}>취소</Button>
            <Button type="primary" htmlType="submit" loading={submitting} style={{ fontWeight: 600 }}>
              저장
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 기기 목록 Modal */}
      <Modal
        title={
          <span>
            기기 목록
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
              {detailLicense?.username}
            </Text>
          </span>
        }
        open={detailLicense !== null}
        onCancel={() => { setDetailLicense(null); setEditingMaxDevices(null); }}
        footer={null}
        width={540}
      >
        {detailLicense && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                background: token.colorFillAlter,
                marginBottom: 16,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>등록 기기</Text>
              <Space size={6} align="center">
                <Text strong>{detailLicense.devices.length} /</Text>
                <InputNumber
                  min={1} max={99} size="small"
                  value={editingMaxDevices ?? detailLicense.max_devices}
                  onChange={(v) => setEditingMaxDevices(v)}
                  style={{ width: 64 }}
                />
                {editingMaxDevices !== null && editingMaxDevices !== detailLicense.max_devices && (
                  <Button size="small" type="primary" onClick={handleUpdateMaxDevices}>저장</Button>
                )}
              </Space>
            </div>
            {detailLicense.devices.length === 0 ? (
              <EmptyLottie description="등록된 기기가 없습니다." />
            ) : (
              <Space orientation="vertical" style={{ width: "100%" }}>
                {detailLicense.devices.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: `1px solid ${token.colorBorderSecondary}`,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <LaptopOutlined style={{ color: token.colorTextSecondary }} />
                        <Text strong style={{ fontSize: 13 }}>
                          {d.device_name ?? "이름 없음"}
                        </Text>
                        <Badge status="success" />
                      </div>
                      <Text
                        type="secondary"
                        style={{ fontSize: 11, display: "block", marginTop: 2 }}
                        ellipsis
                      >
                        {d.hwid}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        마지막 접속: {d.last_seen_at ? formatKST(d.last_seen_at, true) : "-"}
                      </Text>
                    </div>
                    <Popconfirm
                      title="기기 등록을 해제하시겠습니까?"
                      onConfirm={() => handleRemoveDevice(detailLicense.id, d.hwid)}
                      okText="해제"
                      cancelText="취소"
                      okButtonProps={{ danger: true }}
                    >
                      <Button type="text" size="small" danger>해제</Button>
                    </Popconfirm>
                  </div>
                ))}
              </Space>
            )}
          </div>
        )}
      </Modal>
      {/* 메타 데이터 뷰어 Modal */}
      <Modal
        title={
          <span>
            메타 데이터
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
              {metaTarget?.username}
            </Text>
          </span>
        }
        open={metaTarget !== null}
        onCancel={() => setMetaTarget(null)}
        footer={<Button onClick={() => setMetaTarget(null)}>닫기</Button>}
        width={420}
      >
        {metaTarget && (
          <div style={{ marginTop: 16 }}>
            {metaTarget.meta.length === 0 ? (
              <Text type="secondary">메타 데이터가 없습니다.</Text>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {metaTarget.meta.map((m) => (
                  <div
                    key={m.key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: token.colorFillAlter,
                    }}
                  >
                    <Text strong style={{ fontSize: 13 }}>{m.key}</Text>
                    <Text code style={{ fontSize: 13 }}>{m.value}</Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
