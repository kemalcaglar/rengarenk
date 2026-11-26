import type { NextConfig } from 'next';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const RAPOR = `${API}/guvenlik/csp-rapor`;

/**
 * İçerik güvenliği politikası (CSP), şimdilik yalnızca rapor eden modda (Content-Security-Policy-Report-Only): hiçbir
 * şey engellenmez, kurala uymayan kaynak API'ye bildirilir (`/guvenlik/csp-rapor`, günlükte "CSP ihlali"). Bildirim
 * gelmediği görülünce Content-Security-Policy olarak açılır. İzinliler: API (görsel, istek, anlık iletim), Google yazı
 * tipleri, Meta Pixel ve Google etiketi (yalnızca çerez izniyle yüklenir; Karar 35), PayTR ödeme çerçevesi.
 * 'unsafe-inline': Next.js'in sayfa içi betikleri ile veriye bağlı kalan satır içi stiller (renkler API'den gelir).
 * Yeni bir dış kaynak eklerken buraya da ekle.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://connect.facebook.net https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${API} https://www.facebook.com https://*.google-analytics.com https://*.googletagmanager.com https://*.g.doubleclick.net https://www.google.com https://www.google.com.tr`,
  `connect-src 'self' ${API} ${API.replace(/^http/, 'ws')} https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://www.facebook.com https://connect.facebook.net`,
  `frame-src 'self' ${API} https://www.paytr.com https://www.googletagmanager.com https://*.doubleclick.net`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  `report-uri ${RAPOR}`,
  'report-to csp',
].join('; ');

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // Geliştirmede Next.js eval ve anlık yenileme kullanır; politika yalnızca üretim derlemesinde gönderilir
  async headers() {
    if (process.env.NODE_ENV !== 'production') return [];
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy-Report-Only', value: CSP },
          { key: 'Reporting-Endpoints', value: `csp="${RAPOR}"` },
        ],
      },
    ];
  },
};

export default config;
