/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["@aikidosec/firewall"],
};
module.exports = nextConfig;
