/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["@aikidosec/firewall"],
  poweredByHeader: false,
};
module.exports = nextConfig;
