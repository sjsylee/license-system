import { licenseApi, programApi, type Device, type License, type Program } from "./api";
import {
  getLicenseStatus,
  isLicenseCreatedToday,
  isLicenseExpiringWithin,
} from "./license-status";
import { parseBackendDate } from "./utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

export type DashboardLicense = License & {
  programName: string;
};

export type DashboardDevice = Device & {
  key: string;
  licenseId: number;
  licenseKey: string;
  programName: string;
  username: string;
};

export type RecentDashboardDevice = {
  device_name: string;
  program_name: string;
  last_seen_at: string;
  username: string;
};

export type TodayDashboardLicense = {
  license_key: string;
  program_name: string;
  created_at: string;
  username: string;
};

export type ExpiringDashboardLicense = {
  username: string;
  program_name: string;
  expires_at: string;
  days: number;
};

export type DashboardProgramSummary = {
  id: number;
  name: string;
  description: string | null;
  imageSrc: string | null;
  licenseCount: number;
  activeLicenseCount: number;
  inactiveLicenseCount: number;
  activeRatio: number;
};

export type DashboardOverviewFacts = {
  totalPrograms: number;
  totalLicenses: number;
  activeLicenses: number;
  totalDevices: number;
};

export type AdminDashboardReadModel = {
  programs: Program[];
  licenses: DashboardLicense[];
  activeLicenses: DashboardLicense[];
  registeredDevices: DashboardDevice[];
  overview: DashboardOverviewFacts;
  recentDevices: RecentDashboardDevice[];
  todayLicenses: TodayDashboardLicense[];
  expiringLicenses: ExpiringDashboardLicense[];
  programSummaries: DashboardProgramSummary[];
};

type LoadedDashboardData = {
  programs: Program[];
  allLicenses: DashboardLicense[];
  customerLicenses: DashboardLicense[];
};

async function loadDashboardData(): Promise<LoadedDashboardData> {
  const programs = await programApi.list();
  const licenseArrays = await Promise.all(programs.map((program) => licenseApi.list(program.id)));
  const programNamesById = new Map(programs.map((program) => [program.id, program.name]));

  const allLicenses = licenseArrays
    .flat()
    .map((license) => ({
      ...license,
      programName: programNamesById.get(license.program_id) ?? "",
    }));

  return {
    programs,
    allLicenses,
    customerLicenses: allLicenses.filter((license) => license.username !== "Admin"),
  };
}

function sortByDateDesc<T>(items: T[], getDate: (item: T) => string): T[] {
  return [...items].sort((left, right) => {
    const rightTime = parseBackendDate(getDate(right))?.getTime() ?? 0;
    const leftTime = parseBackendDate(getDate(left))?.getTime() ?? 0;
    return rightTime - leftTime;
  });
}

function buildRegisteredDevices(licenses: DashboardLicense[]): DashboardDevice[] {
  return licenses.flatMap((license) =>
    license.devices.map((device) => ({
      ...device,
      key: `${license.id}-${device.id}`,
      licenseId: license.id,
      licenseKey: license.license_key,
      programName: license.programName,
      username: license.username,
    })),
  );
}

function buildRecentDevices(licenses: DashboardLicense[]): RecentDashboardDevice[] {
  const devices = licenses
    .flatMap((license) =>
      license.devices.map((device) => ({
        device_name: device.device_name || device.hwid.slice(0, 8),
        program_name: license.programName,
        last_seen_at: device.last_seen_at,
        username: license.username,
      })),
    )
    .filter((device) => device.last_seen_at);

  return sortByDateDesc(devices, (device) => device.last_seen_at).slice(0, 5);
}

function buildTodayLicenses(licenses: DashboardLicense[]): TodayDashboardLicense[] {
  return sortByDateDesc(
    licenses.filter(isLicenseCreatedToday),
    (license) => license.created_at,
  )
    .slice(0, 5)
    .map((license) => ({
      license_key: license.license_key,
      program_name: license.programName,
      created_at: license.created_at,
      username: license.username,
    }));
}

function buildExpiringLicenses(licenses: DashboardLicense[]): ExpiringDashboardLicense[] {
  return licenses
    .map((license) => ({ license, status: getLicenseStatus(license) }))
    .filter(({ license }) => isLicenseExpiringWithin(license, 3))
    .map(({ license, status }) => ({
      username: license.username,
      program_name: license.programName,
      expires_at: license.expires_at ?? "",
      days: status.daysUntilExpiry ?? 0,
    }))
    .sort((left, right) => left.days - right.days)
    .slice(0, 5);
}

function buildProgramSummaries(programs: Program[], licenses: DashboardLicense[]): DashboardProgramSummary[] {
  return programs.map((program) => {
    const programLicenses = licenses.filter((license) => license.program_id === program.id);
    const activeLicenseCount = programLicenses.filter((license) => getLicenseStatus(license).isActive).length;
    const inactiveLicenseCount = programLicenses.length - activeLicenseCount;

    return {
      id: program.id,
      name: program.name,
      description: program.description,
      imageSrc: program.image_url ? `${API_BASE}${program.image_url}` : null,
      licenseCount: programLicenses.length,
      activeLicenseCount,
      inactiveLicenseCount,
      activeRatio: programLicenses.length ? (activeLicenseCount / programLicenses.length) * 100 : 0,
    };
  });
}

export async function loadAdminDashboardReadModel(): Promise<AdminDashboardReadModel> {
  const { programs, allLicenses, customerLicenses } = await loadDashboardData();
  const activeLicenses = getActiveDashboardLicenses(customerLicenses);
  const registeredDevices = buildRegisteredDevices(customerLicenses);

  return {
    programs,
    licenses: customerLicenses,
    activeLicenses,
    registeredDevices,
    overview: {
      totalPrograms: programs.length,
      totalLicenses: customerLicenses.length,
      activeLicenses: activeLicenses.length,
      totalDevices: registeredDevices.length,
    },
    recentDevices: buildRecentDevices(allLicenses),
    todayLicenses: buildTodayLicenses(allLicenses),
    expiringLicenses: buildExpiringLicenses(allLicenses),
    programSummaries: buildProgramSummaries(programs, allLicenses),
  };
}

export async function loadDashboardLicenses(): Promise<DashboardLicense[]> {
  const readModel = await loadAdminDashboardReadModel();
  return readModel.licenses;
}

export function getActiveDashboardLicenses(licenses: DashboardLicense[]): DashboardLicense[] {
  return licenses.filter((license) => getLicenseStatus(license).isActive);
}

export function getRegisteredDashboardDevices(licenses: DashboardLicense[]): DashboardDevice[] {
  return buildRegisteredDevices(licenses);
}
