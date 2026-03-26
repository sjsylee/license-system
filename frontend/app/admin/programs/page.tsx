"use client";

import {
  CameraOutlined, DeleteOutlined, GithubOutlined,
  PlusOutlined, ReloadOutlined, RightOutlined, SearchOutlined, SettingOutlined,
} from "@ant-design/icons";
import {
  App, Button, Card, Col, Form, Input, Modal, Popconfirm,
  Row, Select, Space, Tag, Tooltip, Typography, theme,
} from "antd";
import Image from "next/image";
import EmptyLottie from "@/components/EmptyLottie";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { programApi, type MetaValueType, type Program } from "@/lib/api";

const { Title, Text } = Typography;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";
const GITHUB_OWNER = process.env.NEXT_PUBLIC_GITHUB_OWNER ?? "";

const VALUE_TYPE_LABELS: Record<MetaValueType, string> = {
  int: "정수",
  float: "실수",
  str: "문자열",
  bool: "불리언",
};

const VALUE_TYPE_COLORS: Record<MetaValueType, string> = {
  int: "blue",
  float: "cyan",
  str: "green",
  bool: "orange",
};

export default function ProgramsPage() {
  const router = useRouter();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState<number | null>(null);
  const [createForm] = Form.useForm();
  const [schemaForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [createImageFile, setCreateImageFile] = useState<File | null>(null);
  const [createImagePreview, setCreateImagePreview] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const imageInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const filteredPrograms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return programs;
    return programs.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
    );
  }, [programs, searchQuery]);

  async function load() {
    try {
      setPrograms(await programApi.list());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(values: { name: string; description?: string }) {
    setSubmitting(true);
    try {
      const created = await programApi.create(values.name, values.description);
      if (createImageFile) {
        await programApi.uploadImage(created.id, createImageFile);
      }
      message.success("프로그램이 등록되었습니다.");
      setCreateOpen(false);
      createForm.resetFields();
      setCreateImageFile(null);
      setCreateImagePreview(null);
      load();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await programApi.delete(deleteTarget.id);
      message.success("삭제되었습니다.");
      setDeleteTarget(null);
      setDeleteConfirmText("");
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  async function handleAddSchema(values: {
    key: string;
    value_type: MetaValueType;
    description?: string;
    default_value?: string;
  }) {
    if (schemaOpen === null) return;
    setSubmitting(true);
    try {
      await programApi.createMetaSchema(schemaOpen, {
        key: values.key,
        value_type: values.value_type,
        description: values.description ?? null,
        default_value: values.default_value ?? null,
      });
      message.success("확장 변수가 추가되었습니다.");
      schemaForm.resetFields();
      load();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSchema(schemaId: number) {
    try {
      await programApi.deleteMetaSchema(schemaId);
      message.success("삭제되었습니다.");
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  }

  async function handleCardImageUpload(programId: number, file: File) {
    try {
      const updated = await programApi.uploadImage(programId, file);
      setPrograms((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      message.success("이미지가 업데이트되었습니다.");
    } catch (e: any) {
      message.error(e.message);
    }
  }

  function handleCreateImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCreateImageFile(file);
    setCreateImagePreview(URL.createObjectURL(file));
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
            프로그램 관리
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            라이선스를 발급할 프로그램을 등록하고 관리하세요.
          </Text>
        </div>
        <Space size={8}>
          <Tooltip title="새로고침">
            <Button icon={<ReloadOutlined />} onClick={() => load()} />
          </Tooltip>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
            style={{ fontWeight: 600 }}
          >
            프로그램 등록
          </Button>
        </Space>
      </div>

      <div
        style={{
          position: "sticky",
          top: 56,
          zIndex: 10,
          background: "var(--admin-bg)",
          paddingBottom: 16,
          marginBottom: 4,
        }}
      >
        <Input
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          placeholder="프로그램 이름 또는 설명으로 검색"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
        />
      </div>

      {!loading && filteredPrograms.length === 0 ? (
        <Card className="glass-card">
          <EmptyLottie
            description={
              searchQuery ? "검색 결과가 없습니다." : "등록된 프로그램이 없습니다."
            }
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredPrograms.map((p) => {
            const imgSrc = p.image_url ? `${API_BASE}${p.image_url}` : null;
            const githubUrl = GITHUB_OWNER
              ? `https://github.com/${GITHUB_OWNER}/${p.name}_r/releases`
              : null;

            return (
              <Col xs={24} md={12} xl={8} key={p.id}>
                <Card
                  loading={loading}
                  className="glass-card"
                  style={{ height: "100%", display: "flex", flexDirection: "column" }}
                  styles={{ body: { flex: 1, display: "flex", flexDirection: "column" }, actions: { padding: "10px 0" } }}
                  cover={
                    <div
                      style={{
                        position: "relative",
                        height: 140,
                        background: imgSrc ? undefined : token.colorFillAlter,
                        borderRadius: "10px 10px 0 0",
                        overflow: "hidden",
                        cursor: "pointer",
                      }}
                      onClick={() => imageInputRefs.current[p.id]?.click()}
                    >
                      {imgSrc ? (
                        <Image
                          src={imgSrc}
                          alt={p.name}
                          fill
                          unoptimized
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            color: token.colorTextTertiary,
                          }}
                        >
                          <CameraOutlined style={{ fontSize: 24 }} />
                          <Text type="secondary" style={{ fontSize: 12 }}>클릭하여 이미지 추가</Text>
                        </div>
                      )}
                      {/* Hover overlay */}
                      <div
                        className="img-overlay"
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(0,0,0,0.4)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: 0,
                          transition: "opacity 0.2s",
                          color: "#fff",
                          fontSize: 13,
                          gap: 6,
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0"; }}
                      >
                        <CameraOutlined />
                        이미지 변경
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        ref={(el) => { imageInputRefs.current[p.id] = el; }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleCardImageUpload(p.id, file);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  }
                  actions={[
                    <Tooltip title="라이선스 관리" key="detail">
                      <Button
                        type="text"
                        icon={<RightOutlined style={{ fontSize: 18 }} />}
                        style={{ height: 44 }}
                        onClick={() => router.push(`/admin/programs/${p.id}`)}
                      />
                    </Tooltip>,
                    ...(githubUrl
                      ? [
                          <Tooltip title="GitHub 릴리즈 페이지" key="github">
                            <Button
                              type="text"
                              icon={<GithubOutlined style={{ fontSize: 18 }} />}
                              style={{ height: 44 }}
                              onClick={() => window.open(githubUrl, "_blank")}
                            />
                          </Tooltip>,
                        ]
                      : []),
                    <Tooltip title="확장 변수 설정" key="schema">
                      <Button
                        type="text"
                        icon={<SettingOutlined style={{ fontSize: 18 }} />}
                        style={{ height: 44 }}
                        onClick={() => setSchemaOpen(p.id)}
                      />
                    </Tooltip>,
                    <Tooltip title="프로그램 삭제" key="delete">
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined style={{ fontSize: 18 }} />}
                        style={{ height: 44 }}
                        onClick={() => { setDeleteTarget({ id: p.id, name: p.name }); setDeleteConfirmText(""); }}
                      />
                    </Tooltip>,
                  ]}
                >
                  <div
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push(`/admin/programs/${p.id}`)}
                  >
                    <div style={{ marginBottom: 12 }}>
                      <Text strong style={{ fontSize: 17 }}>
                        {p.name}
                      </Text>
                      {p.description && (
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 14 }}>
                            {p.description}
                          </Text>
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 6, alignContent: "flex-start" }}>
                      {p.meta_schemas.map((s) => (
                        <Tag
                          key={s.id}
                          color={VALUE_TYPE_COLORS[s.value_type]}
                          style={{ margin: 0 }}
                        >
                          {s.key}
                          <span style={{ marginLeft: 4, opacity: 0.7, fontSize: 10 }}>
                            ({VALUE_TYPE_LABELS[s.value_type]})
                          </span>
                        </Tag>
                      ))}
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* 프로그램 등록 Modal */}
      <Modal
        title="프로그램 등록"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
          setCreateImageFile(null);
          setCreateImagePreview(null);
        }}
        footer={null}
        width={480}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          {/* 이미지 미리보기 + 선택 */}
          <Form.Item label="대표 이미지">
            <div
              style={{
                width: "100%",
                height: 120,
                border: `1px dashed ${token.colorBorder}`,
                borderRadius: 10,
                overflow: "hidden",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: token.colorFillAlter,
                position: "relative",
              }}
              onClick={() => document.getElementById("create-img-input")?.click()}
            >
              {createImagePreview ? (
                <Image
                  src={createImagePreview}
                  alt="preview"
                  fill
                  unoptimized
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <Space orientation="vertical" align="center" size={4}>
                  <CameraOutlined style={{ fontSize: 20, color: token.colorTextTertiary }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>클릭하여 이미지 선택 (선택사항)</Text>
                </Space>
              )}
              <input
                id="create-img-input"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleCreateImageChange}
              />
            </div>
          </Form.Item>

          <Form.Item name="name" label="프로그램 이름" rules={[{ required: true, message: "이름을 입력하세요" }]}>
            <Input placeholder="program-a" />
          </Form.Item>
          <Form.Item name="description" label="설명">
            <Input placeholder="수집 자동화 프로그램" />
          </Form.Item>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => {
              setCreateOpen(false);
              createForm.resetFields();
              setCreateImageFile(null);
              setCreateImagePreview(null);
            }}>취소</Button>
            <Button type="primary" htmlType="submit" loading={submitting} style={{ fontWeight: 600 }}>
              등록
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 확장 변수 관리 Modal */}
      <Modal
        title="확장 변수 관리"
        open={schemaOpen !== null}
        onCancel={() => { setSchemaOpen(null); schemaForm.resetFields(); }}
        footer={null}
        width={560}
      >
        {schemaOpen !== null && (() => {
          const prog = programs.find((p) => p.id === schemaOpen);
          return (
            <div style={{ marginTop: 16 }}>
              {prog?.meta_schemas.length === 0 ? (
                <div style={{ marginBottom: 24 }}>
                  <EmptyLottie description="등록된 확장 변수가 없습니다." />
                </div>
              ) : (
                <Space orientation="vertical" style={{ width: "100%", marginBottom: 24 }}>
                  {prog?.meta_schemas.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: token.colorFillAlter,
                      }}
                    >
                      <div>
                        <Text strong style={{ fontSize: 13 }}>{s.key}</Text>
                        <Tag color={VALUE_TYPE_COLORS[s.value_type]} style={{ marginLeft: 8 }}>
                          {VALUE_TYPE_LABELS[s.value_type]}
                        </Tag>
                        {s.description && (
                          <div><Text type="secondary" style={{ fontSize: 12 }}>{s.description}</Text></div>
                        )}
                      </div>
                      <Popconfirm
                        title="확장 변수를 삭제하시겠습니까?"
                        onConfirm={() => handleDeleteSchema(s.id)}
                        okText="삭제"
                        cancelText="취소"
                        okButtonProps={{ danger: true }}
                      >
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </div>
                  ))}
                </Space>
              )}

              <div
                style={{
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                  paddingTop: 20,
                }}
              >
                <Text strong style={{ display: "block", marginBottom: 12 }}>
                  새 변수 추가
                </Text>
                <Form form={schemaForm} layout="vertical" onFinish={handleAddSchema}>
                  <Row gutter={12}>
                    <Col xs={24} sm={14}>
                      <Form.Item name="key" label="키 이름" rules={[{ required: true }]}>
                        <Input placeholder="max_collection_count" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={10}>
                      <Form.Item name="value_type" label="타입" rules={[{ required: true }]}>
                        <Select
                          placeholder="선택"
                          options={Object.entries(VALUE_TYPE_LABELS).map(([v, label]) => ({ value: v, label }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="description" label="설명">
                    <Input placeholder="최대 수집 가능 개수" />
                  </Form.Item>
                  <Form.Item name="default_value" label="기본값">
                    <Input placeholder="100" />
                  </Form.Item>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button type="primary" htmlType="submit" loading={submitting} style={{ fontWeight: 600 }}>
                      추가
                    </Button>
                  </div>
                </Form>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* 프로그램 삭제 확인 Modal */}
      <Modal
        title={<span style={{ color: "#ff4d4f" }}>프로그램 삭제</span>}
        open={deleteTarget !== null}
        onCancel={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}
        footer={null}
        width={420}
      >
        {deleteTarget && (
          <div style={{ marginTop: 8 }}>
            <p style={{ marginBottom: 16, lineHeight: 1.7 }}>
              <Text type="danger" strong>"{deleteTarget.name}"</Text>을(를) 삭제하면{" "}
              <Text strong>모든 라이선스와 기기 데이터</Text>가 영구 삭제됩니다.<br />
              확인하려면 프로그램 이름을 정확히 입력하세요.
            </p>
            <Input
              placeholder={deleteTarget.name}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              onPressEnter={() => { if (deleteConfirmText === deleteTarget.name) handleDelete(); }}
              onPaste={(e) => e.preventDefault()}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <Button onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}>취소</Button>
              <Button
                danger
                type="primary"
                disabled={deleteConfirmText !== deleteTarget.name}
                onClick={handleDelete}
              >
                삭제
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
