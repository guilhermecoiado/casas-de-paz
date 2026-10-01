/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  optimizeFonts: false,
  eslint: { ignoreDuringBuilds: true },
  // as telas do grupo são todas client-side: reaproveita o que já foi carregado
  // em vez de ir ao servidor a cada toque no menu
  experimental: { staleTimes: { dynamic: 600, static: 1800 } },
  async headers() {
    return [
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] },
    ];
  },
};
export default nextConfig;
