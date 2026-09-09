import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "NODAL — Engineering Room",
  description: "พื้นที่ปฏิบัติการสำหรับทีม engineering และ AI ที่เปลี่ยน context ให้เป็น execution",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
