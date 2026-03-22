import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LicenseOS",
    short_name: "LicenseOS",
    description: "라이선스 발급 및 관리 어드민",
    start_url: "/login",
    display: "standalone",
    background_color: "#f5f5f5",
    theme_color: "#3182F6",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
