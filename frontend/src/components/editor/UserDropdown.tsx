import { logout } from "@/store/authSlice";
import { resetEditor } from "@/store/editorSlice";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { useDispatch } from "react-redux";

interface User {
  email: string;
}

interface UserDropdownProps {
  user: User;
  getUserInitial: (user: User) => string;
}

const UserDropdown: React.FC<UserDropdownProps> = ({
  user,
  getUserInitial,
}) => {
  const dispatch = useDispatch();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    dispatch(resetEditor());
    setIsUserMenuOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsUserMenuOpen((prev) => !prev)}
        className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-bold cursor-pointer"
      >
        {getUserInitial(user)}
      </button>

      {isUserMenuOpen && (
        <div
          className="absolute right-0 top-10 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2 z-50 text-xs"
          onMouseLeave={() => setIsUserMenuOpen(false)}
        >
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
            <div className="font-semibold text-slate-800 dark:text-white truncate">
              {user.email}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors text-left cursor-pointer mt-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default UserDropdown;
