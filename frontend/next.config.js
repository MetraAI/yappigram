/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "",
  },
};

module.exports = nextConfig;
