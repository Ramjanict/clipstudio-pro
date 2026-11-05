import { Moon, Sun } from "lucide-react";

interface Props {
  isDarkMode: boolean;
  toggleTheme: () => void;
}
const DarkButton: React.FC<Props> = ({ isDarkMode, toggleTheme }) => {
  return (
    <button
      onClick={toggleTheme}
      className="absolute top-6 right-6 p-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-md"
      title="Toggle Light / Dark Mode"
    >
      {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
};

export default DarkButton;
