import { RequireRole } from "@/components/auth/RequireRole";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
export default function AdminPage() { return <RequireRole role="admin"><AdminDashboard /></RequireRole>; }
