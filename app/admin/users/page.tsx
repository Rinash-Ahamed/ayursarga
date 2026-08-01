import { RequireRole } from "@/components/auth/RequireRole";
import { UsersList } from "@/components/admin/UsersList";
export default function AdminUsersPage() { return <RequireRole role="admin"><UsersList /></RequireRole>; }
