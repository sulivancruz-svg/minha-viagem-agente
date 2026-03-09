/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy requests to backend em dev
  // Usa prefixo /_mv/ ao inves de /api/ para evitar bloqueio de antivirus
  // que interceptam fetch/XHR para paths /api/ em localhost
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001'
    return [
      {
        source: '/_mv/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
