import { ClerkProvider } from "@clerk/nextjs";
import { AuthHeader } from "@/components/auth-header";
import "./globals.css";

export const runtime = "nodejs";

export const metadata = {
  title: "Lumion HRIS - Human Resource Management System",
  description: "Enterprise-grade HR management system for growing companies",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body>
          <AuthHeader />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
