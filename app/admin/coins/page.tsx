"use client";

import AdminShell, { useAdminShell } from "@/app/components/admin/AdminShell";
import CoinsManagementPanel from "@/app/components/admin/CoinsManagementPanel";
function CoinsRouteContent() {
  const { currentAdminEmail } = useAdminShell();
  if (!currentAdminEmail) {
    return null;
  }

  return <CoinsManagementPanel currentAdminEmail={currentAdminEmail} />;
}

export default function AdminCoinsPage() {
  return (
    <AdminShell>
      <CoinsRouteContent />
    </AdminShell>
  );
}
