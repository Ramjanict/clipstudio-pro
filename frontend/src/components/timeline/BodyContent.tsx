import { api } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addToast } from "@/store/uiSlice";
import type { AdminUser, PlatformStats, UserRole } from "@/types";
import { Film, Folder, Shield, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
export type ActiveTab = "users" | "stats";
interface BodyContentProps {
  activeTab: ActiveTab;
}
const BodyContent: React.FC<BodyContentProps> = ({ activeTab }) => {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((s) => s.ui.isAdminPanelOpen);
  const currentUser = useAppSelector((s) => s.auth.user);

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);

  const isAdminOrSuperAdmin =
    currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get<PlatformStats>("/admin/stats"),
        api.get<AdminUser[]>("/admin/users"),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
    } catch (err: any) {
      dispatch(
        addToast({
          type: "error",
          message: err?.response?.data?.message || "Failed to load admin data",
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  const totalAdminsCount =
    (stats?.roleCounts?.ADMIN || 0) + (stats?.roleCounts?.SUPER_ADMIN || 0);
  const standardUsersCount = stats?.roleCounts?.USER || 0;

  const handleRoleChange = async (targetUserId: string, newRole: UserRole) => {
    try {
      const res = await api.patch<{ message: string; user: AdminUser }>(
        `/admin/users/${targetUserId}/role`,
        { role: newRole },
      );
      dispatch(addToast({ type: "success", message: res.data.message }));
      fetchData();
    } catch (err: any) {
      dispatch(
        addToast({
          type: "error",
          message: err?.response?.data?.message || "Failed to update role",
        }),
      );
    }
  };

  const handleDeleteUser = async (targetUserId: string, email: string) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete user "${email}" and all their projects/assets?`,
      )
    ) {
      return;
    }
    try {
      const res = await api.delete<{ message: string }>(
        `/admin/users/${targetUserId}`,
      );
      dispatch(addToast({ type: "success", message: res.data.message }));
      fetchData();
    } catch (err: any) {
      dispatch(
        addToast({
          type: "error",
          message: err?.response?.data?.message || "Failed to delete user",
        }),
      );
    }
  };
  return (
    <div className="flex-1 overflow-y-auto p-6">
      {activeTab === "stats" && stats && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 p-4 rounded-xl">
              <div className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1.5 mb-1 font-medium">
                <Users className="w-4 h-4 text-blue-500" /> Total Users
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.totalUsers}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 p-4 rounded-xl">
              <div className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1.5 mb-1 font-medium">
                <Folder className="w-4 h-4 text-emerald-500" /> Total Projects
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.totalProjects}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 p-4 rounded-xl">
              <div className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1.5 mb-1 font-medium">
                <Film className="w-4 h-4 text-purple-500" /> Total Assets
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.totalAssets}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 p-4 rounded-xl">
              <div className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1.5 mb-1 font-medium">
                <Shield className="w-4 h-4 text-purple-500" /> Total Admins
              </div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {totalAdminsCount}
              </div>
            </div>
          </div>

          {/* 2 Role Distribution Cards: USER & ADMIN */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-3">
              User Role Distribution (2 Roles)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <Users className="w-4 h-4 text-slate-400" /> Standard Users
                  (USER)
                </div>
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-2">
                  {standardUsersCount}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <Shield className="w-4 h-4 text-purple-500" /> Admins (ADMIN)
                </div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                  {totalAdminsCount}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="space-y-4">
          {loading && users.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Loading users list...
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Projects</th>
                    <th className="px-4 py-3">Assets</th>
                    <th className="px-4 py-3">Role</th>
                    {isAdminOrSuperAdmin && (
                      <th className="px-4 py-3 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900/50">
                  {users.map((u) => {
                    const isSelf =
                      u._id === currentUser?._id || u.id === currentUser?._id;
                    const displayRole =
                      u.role === "SUPER_ADMIN" ? "ADMIN" : u.role || "USER";

                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-600/30 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-[10px]">
                            {u.firstName &&
                            typeof u.firstName === "string" &&
                            u.firstName.trim()
                              ? u.firstName.trim().charAt(0).toUpperCase()
                              : u.email &&
                                  typeof u.email === "string" &&
                                  u.email.trim()
                                ? u.email.trim().charAt(0).toUpperCase()
                                : "U"}
                          </div>
                          <span>
                            {u.firstName} {u.lastName}
                          </span>
                          {isSelf && (
                            <span className="text-[9px] bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold">
                              YOU
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">
                          {u.email}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {u.projectCount}
                        </td>
                        <td className="px-4 py-3 font-mono">{u.assetCount}</td>
                        <td className="px-4 py-3">
                          {isAdminOrSuperAdmin && !isSelf ? (
                            <select
                              value={displayRole}
                              onChange={(e) =>
                                handleRoleChange(
                                  u._id,
                                  e.target.value as UserRole,
                                )
                              }
                              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white rounded px-2.5 py-1 focus:outline-none focus:border-purple-500 cursor-pointer"
                            >
                              <option value="USER">USER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                displayRole === "ADMIN"
                                  ? "bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-500/30"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              {displayRole}
                            </span>
                          )}
                        </td>
                        {isAdminOrSuperAdmin && (
                          <td className="px-4 py-3 text-right">
                            {!isSelf && (
                              <button
                                onClick={() =>
                                  handleDeleteUser(u._id, u.email || "user")
                                }
                                className="p-1.5 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                                title="Delete user"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BodyContent;
