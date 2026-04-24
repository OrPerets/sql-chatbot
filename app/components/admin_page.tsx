"use client";

import AdminShell from "./admin/AdminShell";
import CommandCenter from "./admin/CommandCenter";

export default function AdminPage() {
  return (
    <AdminShell>
      <CommandCenter />
    </AdminShell>
  );
}
