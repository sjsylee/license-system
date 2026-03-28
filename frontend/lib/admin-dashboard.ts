import { licenseApi, programApi, type Device, type License } from "./api";

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

export async function loadDashboardLicenses(): Promise<DashboardLicense[]> {
  const programs = await programApi.list();
  const licenseArrays = await Promise.all(programs.map((program) => licenseApi.list(program.id)));
  const programMap = Object.fromEntries(programs.map((program) => [program.id, program.name]));

  return licenseArrays
    .flat()
    .filter((license) => license.username !== "Admin")
    .map((license) => ({
      ...license,
      programName: programMap[license.program_id] ?? "",
    }));
}

export function getActiveDashboardLicenses(licenses: DashboardLicense[]): DashboardLicense[] {
  return licenses.filter((license) => license.is_active);
}

export function getRegisteredDashboardDevices(licenses: DashboardLicense[]): DashboardDevice[] {
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
