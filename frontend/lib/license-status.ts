import { daysUntil, formatKST, isToday, parseBackendDate } from "./utils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type LicenseStatusInput = {
  is_active: boolean;
  expires_at: string | null;
};

export type LicenseDateInput = {
  created_at: string;
};

export type LicenseExpiryStatusKind =
  | "permanent"
  | "invalid"
  | "expired"
  | "today"
  | "soon"
  | "future";

export type LicenseExpiryStatus = {
  kind: LicenseExpiryStatusKind;
  expiresAt: Date | null;
  formattedDate: string | null;
  daysUntilExpiry: number | null;
  legacyElectronRemainingDays: number | null;
  isExpired: boolean;
  isPermanent: boolean;
  expiresToday: boolean;
};

export type LicenseStatus = LicenseExpiryStatus & {
  isActive: boolean;
  isUsable: boolean;
};

export function getLicenseExpiryStatus(expiresAtValue: string | null): LicenseExpiryStatus {
  if (!expiresAtValue) {
    return {
      kind: "permanent",
      expiresAt: null,
      formattedDate: null,
      daysUntilExpiry: null,
      legacyElectronRemainingDays: null,
      isExpired: false,
      isPermanent: true,
      expiresToday: false,
    };
  }

  const expiresAt = parseBackendDate(expiresAtValue);
  if (!expiresAt) {
    return {
      kind: "invalid",
      expiresAt: null,
      formattedDate: null,
      daysUntilExpiry: null,
      legacyElectronRemainingDays: null,
      isExpired: false,
      isPermanent: false,
      expiresToday: false,
    };
  }

  const isExpired = expiresAt.getTime() < Date.now();
  const daysUntilExpiry = daysUntil(expiresAtValue);
  const legacyElectronRemainingDays = getLegacyElectronRemainingDays(expiresAtValue);
  const expiresToday = daysUntilExpiry === 0;
  const kind: LicenseExpiryStatusKind = isExpired
    ? "expired"
    : expiresToday
      ? "today"
      : daysUntilExpiry <= 30
        ? "soon"
        : "future";

  return {
    kind,
    expiresAt,
    formattedDate: formatKST(expiresAtValue),
    daysUntilExpiry,
    legacyElectronRemainingDays,
    isExpired,
    isPermanent: false,
    expiresToday,
  };
}

export function getLicenseStatus(license: LicenseStatusInput): LicenseStatus {
  const expiryStatus = getLicenseExpiryStatus(license.expires_at);

  return {
    ...expiryStatus,
    isActive: license.is_active,
    isUsable: license.is_active && !expiryStatus.isExpired,
  };
}

export function isLicenseExpired(license: LicenseStatusInput): boolean {
  return getLicenseStatus(license).isExpired;
}

export function isLicenseUsable(license: LicenseStatusInput): boolean {
  return getLicenseStatus(license).isUsable;
}

export function isLicenseCreatedToday(license: LicenseDateInput): boolean {
  return isToday(license.created_at);
}

export function isLicenseExpiringWithin(license: LicenseStatusInput, days: number): boolean {
  const status = getLicenseStatus(license);

  return (
    status.isActive &&
    status.daysUntilExpiry !== null &&
    status.daysUntilExpiry >= 0 &&
    status.daysUntilExpiry <= days
  );
}

export function getLicenseExpirySortTime(license: Pick<LicenseStatusInput, "expires_at">): number {
  if (!license.expires_at) return Number.MAX_SAFE_INTEGER;
  return parseBackendDate(license.expires_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

export function getLegacyElectronRemainingDays(expiresAtValue: string | null): number | null {
  if (!expiresAtValue) return null;

  const expiry = new Date(expiresAtValue).getTime();
  if (Number.isNaN(expiry)) return null;

  return Math.max(0, Math.floor((expiry - Date.now()) / MS_PER_DAY));
}
