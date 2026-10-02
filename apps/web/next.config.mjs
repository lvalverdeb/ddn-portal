/** @type {import('next').NextConfig} */
const nextConfig = {
  // packages/* are workspace sources (not pre-built), so Next needs to
  // transpile them itself rather than expecting compiled JS.
  transpilePackages: ["@ddn-portal/ddn-client", "@ddn-portal/bridge", "@ddn-portal/db"],
};

export default nextConfig;
