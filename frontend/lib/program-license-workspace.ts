"use client";

import { Form } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";

import { licenseApi, programApi, type License, type Program } from "@/lib/api";
import {
  getLicenseExpirySortTime,
  isLicenseExpired,
  isLicenseUsable,
} from "@/lib/license-status";
import { parseBackendDate } from "@/lib/utils";

export const QUICK_DATES = [
  { label: "1주일", amount: 7, unit: "day" as const },
  { label: "1개월", amount: 1, unit: "month" as const },
  { label: "3개월", amount: 3, unit: "month" as const },
  { label: "6개월", amount: 6, unit: "month" as const },
];

export type FilterKey = "all" | "active" | "inactive" | "expired";
export type SortKey = "newest" | "expiry_asc";
export type QuickDateUnit = (typeof QUICK_DATES)[number]["unit"];

export type ExtendFormValues = {
  extends_at: Dayjs | null;
};

export type CreateLicenseFormValues = Record<string, string | number | Dayjs | null | undefined> & {
  username: string;
  expires_at?: Dayjs | null;
  max_devices?: number;
  user_id?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type ContactFormValues = {
  user_id?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type MetaFormValues = Record<string, string | number | null | undefined>;

type Notify = {
  success: (content: string) => void;
  error: (content: string) => void;
};

type UseProgramLicenseWorkspaceOptions = {
  programId: number;
  notify: Notify;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
}

function getExtendBaseDate(license: License): Dayjs {
  const expiresAt = license.expires_at ? dayjs(license.expires_at) : null;

  if (expiresAt && expiresAt.isAfter(dayjs())) {
    return expiresAt;
  }

  return dayjs();
}

function buildMetaFormInitialValues(program: Program | null, license: License): Record<string, string> {
  const initialValues: Record<string, string> = {};

  program?.meta_schemas.forEach((schema) => {
    const existing = license.meta.find((meta) => meta.key === schema.key);
    initialValues[`meta_${schema.id}`] = existing?.value ?? schema.default_value ?? "";
  });

  return initialValues;
}

export function useProgramLicenseWorkspace({
  programId,
  notify,
}: UseProgramLicenseWorkspaceOptions) {
  const [program, setProgram] = useState<Program | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailLicense, setDetailLicense] = useState<License | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterKey, setFilterKey] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [extendTarget, setExtendTarget] = useState<License | null>(null);
  const [extendInitialBase, setExtendInitialBase] = useState<Dayjs | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [editingMaxDevices, setEditingMaxDevices] = useState<number | null>(null);
  const [contactTarget, setContactTarget] = useState<License | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [metaTarget, setMetaTarget] = useState<License | null>(null);
  const [form] = Form.useForm<CreateLicenseFormValues>();
  const [extendForm] = Form.useForm<ExtendFormValues>();
  const [contactForm] = Form.useForm<ContactFormValues>();
  const [metaForm] = Form.useForm<MetaFormValues>();

  const load = useCallback(async () => {
    try {
      const [nextProgram, nextLicenses] = await Promise.all([
        programApi.get(programId),
        licenseApi.list(programId),
      ]);
      setProgram(nextProgram);
      setLicenses(nextLicenses);
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const stats = useMemo(
    () => ({
      all: licenses.length,
      active: licenses.filter(isLicenseUsable).length,
      inactive: licenses.filter((license) => !license.is_active).length,
      expired: licenses.filter(isLicenseExpired).length,
    }),
    [licenses],
  );

  const filtered = useMemo(() => {
    let base = licenses;
    if (filterKey === "active") base = licenses.filter(isLicenseUsable);
    else if (filterKey === "inactive") base = licenses.filter((license) => !license.is_active);
    else if (filterKey === "expired") base = licenses.filter(isLicenseExpired);

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      base = base.filter((license) => license.username.toLowerCase().includes(query));
    }

    return [...base].sort((left, right) => {
      if (sortKey === "newest") {
        const rightTime = parseBackendDate(right.created_at)?.getTime() ?? 0;
        const leftTime = parseBackendDate(left.created_at)?.getTime() ?? 0;
        return rightTime - leftTime;
      }

      return getLicenseExpirySortTime(left) - getLicenseExpirySortTime(right);
    });
  }, [licenses, filterKey, searchQuery, sortKey]);

  async function handleCreate(values: CreateLicenseFormValues) {
    setSubmitting(true);
    try {
      const meta = program?.meta_schemas
        .map((schema) => ({
          schema_id: schema.id,
          value: String(values[`meta_${schema.id}`] ?? schema.default_value ?? ""),
        }))
        .filter((entry) => entry.value !== "");

      await licenseApi.create({
        program_id: programId,
        username: values.username,
        expires_at: values.expires_at ? dayjs(values.expires_at).toISOString() : null,
        max_devices: values.max_devices ?? 3,
        meta,
        user_id: values.user_id || null,
        email: values.email || null,
        phone: values.phone || null,
      });
      notify.success("라이선스가 발급되었습니다.");
      setCreateOpen(false);
      form.resetFields();
      void load();
    } catch (error: unknown) {
      notify.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(license: License) {
    try {
      await licenseApi.update(license.id, { is_active: !license.is_active });
      void load();
    } catch (error: unknown) {
      notify.error(getErrorMessage(error));
    }
  }

  async function handleDelete(id: number) {
    try {
      await licenseApi.delete(id);
      notify.success("삭제되었습니다.");
      void load();
    } catch (error: unknown) {
      notify.error(getErrorMessage(error));
    }
  }

  async function handleUpdateMaxDevices() {
    if (!detailLicense || editingMaxDevices === null) return;
    try {
      await licenseApi.update(detailLicense.id, { max_devices: editingMaxDevices });
      setDetailLicense({ ...detailLicense, max_devices: editingMaxDevices });
      setEditingMaxDevices(null);
      void load();
      notify.success("허용 기기 수가 변경되었습니다.");
    } catch (error: unknown) {
      notify.error(getErrorMessage(error));
    }
  }

  async function handleExtend(values: ExtendFormValues) {
    if (!extendTarget) return;
    setSubmitting(true);
    try {
      await licenseApi.update(extendTarget.id, {
        expires_at: values.extends_at ? dayjs(values.extends_at).toISOString() : null,
      });
      notify.success("만료일이 연장되었습니다.");
      closeExtendModal();
      void load();
    } catch (error: unknown) {
      notify.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateContact(values: ContactFormValues) {
    if (!contactTarget) return;
    setSubmitting(true);
    try {
      await licenseApi.update(contactTarget.id, {
        user_id: values.user_id || null,
        email: values.email || null,
        phone: values.phone || null,
      });
      notify.success("연락처가 수정되었습니다.");
      closeContactModal();
      void load();
    } catch (error: unknown) {
      notify.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveDevice(licenseId: number, hwid: string) {
    try {
      await licenseApi.removeDevice(licenseId, hwid);
      notify.success("기기 등록이 해제되었습니다.");
      if (detailLicense) {
        const updated = await licenseApi.get(licenseId);
        setDetailLicense(updated);
        void load();
      }
    } catch (error: unknown) {
      notify.error(getErrorMessage(error));
    }
  }

  async function handleUpdateMeta(values: MetaFormValues) {
    if (!metaTarget || !program) return;
    setSubmitting(true);
    try {
      const updates = program.meta_schemas
        .filter((schema) => values[`meta_${schema.id}`] != null)
        .map((schema) => ({
          schema_id: schema.id,
          value: String(values[`meta_${schema.id}`]),
        }));
      const updated = await licenseApi.updateMeta(metaTarget.id, updates);
      setLicenses((previous) => previous.map((license) => (license.id === updated.id ? updated : license)));
      notify.success("메타 데이터가 수정되었습니다.");
      closeMetaModal();
    } catch (error: unknown) {
      notify.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function copyKey(key: string) {
    void navigator.clipboard.writeText(key);
    notify.success("복사되었습니다.");
  }

  function setQuickDate(amount: number, unit: QuickDateUnit) {
    form.setFieldValue("expires_at", dayjs().add(amount, unit));
  }

  function openExtendModal(license: License) {
    const base = getExtendBaseDate(license);
    setExtendTarget(license);
    setExtendInitialBase(base);
    extendForm.setFieldValue("extends_at", base);
  }

  function closeExtendModal() {
    setExtendTarget(null);
    setExtendInitialBase(null);
    extendForm.resetFields();
  }

  function resetExtendDate() {
    if (!extendInitialBase) return;
    extendForm.setFieldValue("extends_at", extendInitialBase);
  }

  function addExtendQuickDate(amount: number, unit: QuickDateUnit) {
    const currentValue = extendForm.getFieldValue("extends_at");
    const base = dayjs.isDayjs(currentValue)
      ? currentValue
      : extendInitialBase ?? (extendTarget ? getExtendBaseDate(extendTarget) : dayjs());

    extendForm.setFieldValue("extends_at", base.add(amount, unit));
  }

  function openContactModal(license: License) {
    setContactTarget(license);
    contactForm.setFieldsValue({
      user_id: license.user_id ?? "",
      email: license.email ?? "",
      phone: license.phone ?? "",
    });
  }

  function closeContactModal() {
    setContactTarget(null);
    contactForm.resetFields();
  }

  function openDetailModal(license: License) {
    setDetailLicense(license);
  }

  function closeDetailModal() {
    setDetailLicense(null);
    setEditingMaxDevices(null);
  }

  function openMetaModal(license: License) {
    metaForm.setFieldsValue(buildMetaFormInitialValues(program, license));
    setMetaTarget(license);
  }

  function closeMetaModal() {
    setMetaTarget(null);
    metaForm.resetFields();
  }

  return {
    program,
    licenses,
    loading,
    createOpen,
    detailLicense,
    submitting,
    filterKey,
    searchQuery,
    extendTarget,
    isMobile,
    editingMaxDevices,
    contactTarget,
    sortKey,
    metaTarget,
    form,
    extendForm,
    contactForm,
    metaForm,
    stats,
    filtered,
    load,
    setCreateOpen,
    setFilterKey,
    setSearchQuery,
    setEditingMaxDevices,
    setSortKey,
    handleCreate,
    handleToggleActive,
    handleDelete,
    handleUpdateMaxDevices,
    handleExtend,
    handleUpdateContact,
    handleRemoveDevice,
    handleUpdateMeta,
    copyKey,
    setQuickDate,
    openExtendModal,
    closeExtendModal,
    resetExtendDate,
    addExtendQuickDate,
    openContactModal,
    closeContactModal,
    openDetailModal,
    closeDetailModal,
    openMetaModal,
    closeMetaModal,
  };
}
