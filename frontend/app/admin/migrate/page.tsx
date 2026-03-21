"use client";

import { CheckCircleOutlined, CloseCircleOutlined, ImportOutlined } from "@ant-design/icons";
import {
  Alert, App, Button, Card, Col, Divider, Form, Input, InputNumber,
  Row, Select, Space, Table, Tag, Typography, theme,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import {
  licenseApi, programApi,
  type BulkImportItemResult, type BulkImportResponse,
  type BulkLicenseItem, type MetaSchema, type Program,
} from "@/lib/api";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface LegacyUser {
  id: string;
  secretKey: string;
  expiry: number;
}

function parseLegacyJson(raw: string): { items: BulkLicenseItem[]; error: string | null } {
  try {
    const parsed = JSON.parse(raw);
    const users: LegacyUser[] = parsed.users ?? parsed;
    if (!Array.isArray(users))
      return { items: [], error: "JSON 형식이 올바르지 않습니다. `users` 배열이 필요합니다." };
    const items: BulkLicenseItem[] = users.map((u) => ({
      username: u.id,
      license_key: u.secretKey,
      expires_at: u.expiry ? new Date(u.expiry).toISOString() : null,
    }));
    return { items, error: null };
  } catch {
    return { items: [], error: "JSON 파싱에 실패했습니다. 형식을 확인해주세요." };
  }
}

export default function MigratePage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [maxDevices, setMaxDevices] = useState(5);
  const [rawJson, setRawJson] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BulkLicenseItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkImportResponse | null>(null);
  // 메타: { schema_id → value }
  const [metaValues, setMetaValues] = useState<Record<number, string>>({});

  useEffect(() => {
    programApi.list().then(setPrograms);
  }, []);

  function handleSelectProgram(id: number) {
    const prog = programs.find((p) => p.id === id) ?? null;
    setSelectedProgram(prog);
    // 프로그램 변경 시 메타 초기화 (default_value 적용)
    const initial: Record<number, string> = {};
    prog?.meta_schemas.forEach((s) => {
      initial[s.id] = s.default_value ?? "";
    });
    setMetaValues(initial);
    setPreview([]);
    setResult(null);
  }

  function handleParse() {
    const { items, error } = parseLegacyJson(rawJson);
    setParseError(error);
    setPreview(items);
    setResult(null);
    if (items.length > 0) message.success(`${items.length}건 파싱 완료`);
  }

  async function handleImport() {
    if (!selectedProgram) { message.warning("프로그램을 선택해주세요."); return; }
    if (preview.length === 0) { message.warning("먼저 JSON을 파싱해주세요."); return; }

    // 필수 메타 (default_value 없는 것) 값 체크
    const missing = selectedProgram.meta_schemas.filter(
      (s) => !s.default_value && !metaValues[s.id]
    );
    if (missing.length > 0) {
      message.warning(`메타 값을 입력해주세요: ${missing.map((s) => s.key).join(", ")}`);
      return;
    }

    const meta = selectedProgram.meta_schemas
      .map((s) => ({ schema_id: s.id, value: metaValues[s.id] ?? s.default_value ?? "" }))
      .filter((m) => m.value !== "");

    setImporting(true);
    try {
      const res = await licenseApi.bulkImport(selectedProgram.id, maxDevices, preview, meta);
      setResult(res);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setRawJson("");
    setPreview([]);
    setParseError(null);
    setResult(null);
  }

  const schemas: MetaSchema[] = selectedProgram?.meta_schemas ?? [];

  const previewColumns = [
    {
      title: "사용자",
      dataIndex: "username",
      key: "username",
      render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: "라이선스 키",
      dataIndex: "license_key",
      key: "license_key",
      render: (v: string) => (
        <Text code style={{ fontSize: 11 }}>{v.length > 20 ? `${v.slice(0, 20)}…` : v}</Text>
      ),
    },
    {
      title: "만료일",
      dataIndex: "expires_at",
      key: "expires_at",
      render: (v: string | null) =>
        v ? (
          <Text style={{ fontSize: 12 }}>{dayjs(v).format("YYYY.MM.DD")}</Text>
        ) : (
          <Tag color="blue">무기한</Tag>
        ),
    },
  ];

  const resultColumns = [
    {
      title: "사용자",
      dataIndex: "username",
      key: "username",
      render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: "라이선스 키",
      dataIndex: "license_key",
      key: "license_key",
      render: (v: string) => (
        <Text code style={{ fontSize: 11 }}>{v.length > 20 ? `${v.slice(0, 20)}…` : v}</Text>
      ),
    },
    {
      title: "결과",
      key: "success",
      render: (_: any, r: BulkImportItemResult) =>
        r.success ? (
          <Space size={4}>
            <CheckCircleOutlined style={{ color: "#00B448" }} />
            <Text style={{ color: "#00B448", fontSize: 12 }}>완료</Text>
          </Space>
        ) : (
          <Space size={4}>
            <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
            <Text style={{ color: "#ff4d4f", fontSize: 12 }}>{r.error ?? "실패"}</Text>
          </Space>
        ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
          데이터 마이그레이션
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          기존 라이선스 키를 유지한 채로 새 시스템으로 일괄 가져옵니다.
        </Text>
      </div>

      {/* 설정 */}
      <Card style={{ marginBottom: 20 }}>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} sm={12}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13 }}>
              대상 프로그램 <span style={{ color: "#ff4d4f" }}>*</span>
            </Text>
            <Select
              style={{ width: "100%" }}
              placeholder="프로그램 선택"
              value={selectedProgram?.id ?? undefined}
              onChange={handleSelectProgram}
              options={programs.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Text strong style={{ display: "block", marginBottom: 6, fontSize: 13 }}>
              허용 기기 수
            </Text>
            <InputNumber
              min={1} max={99}
              value={maxDevices}
              onChange={(v) => setMaxDevices(v ?? 5)}
              style={{ width: "100%" }}
            />
          </Col>
        </Row>

        {/* 메타 스키마 영역 */}
        {schemas.length > 0 && (
          <>
            <Divider style={{ margin: "20px 0 16px" }} />
            <Text strong style={{ display: "block", marginBottom: 4, fontSize: 13 }}>
              확장 변수 일괄 설정
            </Text>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 14 }}>
              아래 값이 가져오는 모든 라이선스에 동일하게 적용됩니다.
            </Text>
            <Row gutter={[12, 12]}>
              {schemas.map((s) => {
                const isRequired = !s.default_value;
                return (
                  <Col xs={24} sm={12} md={8} key={s.id}>
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: `1px solid ${isRequired && !metaValues[s.id] ? "#ff4d4f" : token.colorBorderSecondary}`,
                        background: token.colorFillAlter,
                      }}
                    >
                      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <Text strong style={{ fontSize: 13 }}>{s.key}</Text>
                        <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>{s.value_type}</Tag>
                        {isRequired && <Tag color="red" style={{ margin: 0, fontSize: 10 }}>필수</Tag>}
                      </div>
                      {s.description && (
                        <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 6 }}>
                          {s.description}
                        </Text>
                      )}
                      {s.value_type === "bool" ? (
                        <Select
                          style={{ width: "100%" }}
                          size="small"
                          value={metaValues[s.id] || s.default_value || undefined}
                          onChange={(v) => setMetaValues((prev) => ({ ...prev, [s.id]: v }))}
                          placeholder="선택"
                          options={[
                            { value: "true", label: "true" },
                            { value: "false", label: "false" },
                          ]}
                        />
                      ) : (
                        <InputNumber
                          style={{ width: "100%" }}
                          size="small"
                          step={s.value_type === "float" ? 0.1 : 1}
                          value={metaValues[s.id] ? Number(metaValues[s.id]) : undefined}
                          placeholder={s.default_value ?? "값 입력"}
                          onChange={(v) =>
                            setMetaValues((prev) => ({ ...prev, [s.id]: v != null ? String(v) : "" }))
                          }
                        />
                      )}
                    </div>
                  </Col>
                );
              })}
            </Row>
          </>
        )}
      </Card>

      {/* JSON 입력 */}
      <Card
        style={{ marginBottom: 20 }}
        title={<Text strong>JSON 붙여넣기</Text>}
        extra={
          <Space>
            <Button onClick={handleReset} disabled={!rawJson && preview.length === 0}>초기화</Button>
            <Button type="primary" onClick={handleParse} disabled={!rawJson.trim()}>파싱</Button>
          </Space>
        }
      >
        <TextArea
          rows={10}
          value={rawJson}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setRawJson(e.target.value);
            setPreview([]);
            setParseError(null);
            setResult(null);
          }}
          placeholder={`{\n  "users": [\n    { "id": "사용자명", "secretKey": "키값", "expiry": 1789570800000 },\n    ...\n  ]\n}`}
          style={{ fontFamily: "monospace", fontSize: 12 }}
        />
        {parseError && (
          <Alert type="error" message={parseError} style={{ marginTop: 12 }} showIcon />
        )}
      </Card>

      {/* 미리보기 */}
      {preview.length > 0 && !result && (
        <Card
          style={{ marginBottom: 20 }}
          title={
            <Space>
              <Text strong>미리보기</Text>
              <Tag color="blue">{preview.length}건</Tag>
            </Space>
          }
          extra={
            <Button
              type="primary"
              icon={<ImportOutlined />}
              loading={importing}
              onClick={handleImport}
              disabled={!selectedProgram}
              style={{ fontWeight: 600 }}
            >
              가져오기
            </Button>
          }
        >
          <Table
            dataSource={preview}
            columns={previewColumns}
            rowKey="license_key"
            pagination={{ pageSize: 10, showSizeChanger: false }}
            size="small"
          />
        </Card>
      )}

      {/* 결과 */}
      {result && (
        <Card
          title={
            <Space>
              <Text strong>가져오기 결과</Text>
              <Tag color="green">완료 {result.imported}건</Tag>
              {result.skipped > 0 && <Tag color="orange">건너뜀 {result.skipped}건</Tag>}
            </Space>
          }
          extra={<Button onClick={handleReset}>새로 가져오기</Button>}
        >
          <div
            style={{
              display: "flex",
              gap: 24,
              padding: "16px 20px",
              borderRadius: 10,
              background: token.colorFillAlter,
              marginBottom: 16,
            }}
          >
            {[
              { label: "전체", value: result.total, color: undefined },
              { label: "완료", value: result.imported, color: "#00B448" },
              { label: "건너뜀", value: result.skipped, color: "#fa8c16" },
            ].map((s) => (
              <div key={s.label}>
                <Text type="secondary" style={{ fontSize: 11 }}>{s.label}</Text>
                <div>
                  <Text strong style={{ fontSize: 22, color: s.color }}>{s.value}</Text>
                </div>
              </div>
            ))}
          </div>
          <Table
            dataSource={result.results}
            columns={resultColumns}
            rowKey="license_key"
            pagination={{ pageSize: 10, showSizeChanger: false }}
            size="small"
          />
        </Card>
      )}
    </div>
  );
}
