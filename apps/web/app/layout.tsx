import "@repo/ui/globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@repo/ui/components/sonner";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="kr" suppressHydrationWarning>
      <body className={`mx-auto scroll-smooth antialiased relative w-full`}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
