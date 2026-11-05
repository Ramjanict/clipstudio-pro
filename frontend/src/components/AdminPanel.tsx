import { api } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addToast } from "@/store/uiSlice";
import type { AdminUser } from "@/types";
import { Film, Users } from "lucide-react";
import { useEffect, useState } from "react";
import AdminHeader from "./admin/AdminHeader";
import type { NavigationTab } from "./admin/NavigationTabs";
import NavigationTabs from "./admin/NavigationTabs";
import BodyContent from "./timeline/BodyContent";
export type ActiveTab = "users" | "stats";
export function AdminPanel() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((s) => s.ui.isAdminPanelOpen);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("users");

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersRes = await api.get<AdminUser[]>("/admin/users");
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

  if (!isOpen) return null;

  const tabs: NavigationTab[] = [
    {
      id: "users",
      label: "User Management",
      icon: Users,
      count: users.length,
    },
    {
      id: "stats",
      label: "Platform Stats",
      icon: Film,
    },
  ];
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        <AdminHeader loading={loading} fetchData={fetchData} />
        <NavigationTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as ActiveTab)}
        />
        <BodyContent activeTab={activeTab} />
      </div>
    </div>
  );
}

export default AdminPanel;
