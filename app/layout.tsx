import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata = {
  title: { default: "Nexus UI", template: "%s | Nexus UI" },
  description: "Flexible, customizable components for modern AI experiences.",
  openGraph: { title: "Nexus UI", description: "..." },
  // optional: icons, twitter, etc.
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
