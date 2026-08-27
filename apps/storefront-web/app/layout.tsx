import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://zhudatuan.com'),
  title: '智慧翼企业福利商城｜企业员工福利平台',
  description: '面向企业员工的福利商品、卡券、生活服务和订单管理平台，由雍彻科技提供技术服务。',
  applicationName: '智慧翼企业福利商城',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: '/',
    siteName: '智慧翼 Smart Wing',
    title: '智慧翼企业福利商城｜企业员工福利平台',
    description: '面向企业员工的福利商品、卡券、生活服务和订单管理平台。',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: '智慧翼企业福利商城' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '智慧翼企业福利商城｜企业员工福利平台',
    description: '面向企业员工的福利商品、卡券、生活服务和订单管理平台。',
    images: ['/opengraph-image.png'],
  },
  formatDetection: { email: false, address: false, telephone: false },
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#143A8F',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
