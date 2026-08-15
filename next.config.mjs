/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A stray package-lock.json in the home directory otherwise makes Turbopack
  // guess the wrong workspace root.
  turbopack: { root: import.meta.dirname },
  async headers() {
    return [
      {
        // Apple fetches this extensionless file and requires JSON content type.
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default nextConfig;
