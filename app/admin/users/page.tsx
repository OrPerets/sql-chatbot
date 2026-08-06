import AdminShell from "@/app/components/admin/AdminShell";
import UsersManagementPage from "@/app/components/admin/UsersManagementPage";

export default function AdminUsersPage() {
  return (
    <AdminShell>
      <UsersManagementPage />
    </AdminShell>
  );
}
