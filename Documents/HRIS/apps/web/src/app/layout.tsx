import { ClerkProvider, SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
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
          <header className="flex items-center justify-between p-4">
            <div className="text-lg font-semibold">Lumion HRIS</div>
            <div className="flex gap-4">
              <Show when="signed-out">
                <SignInButton />
                <SignUpButton />
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </div>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
