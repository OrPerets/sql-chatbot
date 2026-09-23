import AdminShell from "@/app/components/admin/AdminShell";
import StudentProfiles from "@/app/components/admin/StudentProfiles";

export default function AdminStudentsPage() {
  return (
    <AdminShell>
      <StudentProfiles />
    </AdminShell>
  );
}
