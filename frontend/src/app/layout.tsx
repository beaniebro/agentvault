import type { Metadata } from "next";
import { Providers } from "./providers";
import { Sidebar } from "@/components/Sidebar";
import { ConnectWallet } from "@/components/ConnectWallet";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentVault — Transaction Firewall for AI Agents",
  description: "On-chain security for AI agent transactions on Sui",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col">
              <header className="border-b border-gray-800 px-6 py-3 flex justify-between items-center">
                <h2 className="text-lg font-semibold">AgentVault</h2>
                <ConnectWallet />
              </header>
              <main className="flex-1 p-6">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
