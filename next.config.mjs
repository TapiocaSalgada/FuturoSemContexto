/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https:",
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "media-src 'self' blob: https:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
];

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.anilist.co" },
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      { protocol: "https", hostname: "myanimelist.net" },
      { protocol: "https", hostname: "goyabu.io" },
      { protocol: "https", hostname: "static.wikia.nocookie.net" },
      { protocol: "https", hostname: "*.ytimg.com" },
      { protocol: "https", hostname: "gqcanimes.com.br" },
      { protocol: "https", hostname: "media.fstatic.com" },
      { protocol: "https", hostname: "api.myblogapi.site" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "uploads.mangadex.org" },
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "*.thetvdb.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
