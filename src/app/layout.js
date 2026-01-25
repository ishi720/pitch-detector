import "./globals.css";

export const metadata = {
  title: "音程検出器 - Pitch Detector",
  description: "リアルタイムで音声から音程を検出するWebアプリケーション",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
