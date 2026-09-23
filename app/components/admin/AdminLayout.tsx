"use client";

import React from "react";

import AdminShell from "./AdminShell";

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  currentUser?: string | null;
  onLogout?: () => void;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <AdminShell>{children}</AdminShell>;
}
