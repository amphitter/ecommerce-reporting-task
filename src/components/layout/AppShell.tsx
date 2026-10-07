"use client";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

interface AppShellProps {
  title: string;
  breadcrumb?: string[];
  children: React.ReactNode;
}

export default function AppShell({ title, breadcrumb, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="xl:pl-60 min-h-screen flex flex-col">
        <Topbar title={title} breadcrumb={breadcrumb} />
        <main className="flex-1 p-4 md:p-6 pb-20 xl:pb-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
