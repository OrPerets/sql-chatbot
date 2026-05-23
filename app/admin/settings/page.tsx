import AdminShell from "@/app/components/admin/AdminShell";
import SystemSettingsPage from "@/app/components/admin/SystemSettingsPage";

export default function AdminSettingsRoute() {
  return (
    <AdminShell>
      <SystemSettingsPage />
    </AdminShell>
  );
}
