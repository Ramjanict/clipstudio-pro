import type { LucideIcon } from "lucide-react";

export interface NavigationTab {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

interface NavigationTabsProps {
  tabs: NavigationTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

const NavigationTabs = ({
  tabs,
  activeTab,
  onTabChange,
  className = "",
}: NavigationTabsProps) => {
  return (
    <div
      className={`flex bg-slate-100 dark:bg-slate-950 px-6 border-b border-slate-200 dark:border-slate-800 text-xs ${className}`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`py-3 px-4 font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              isActive
                ? "border-purple-500 text-purple-600 dark:text-purple-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Icon className="w-4 h-4" />

            {tab.label}

            {tab.count !== undefined && ` (${tab.count})`}
          </button>
        );
      })}
    </div>
  );
};

export default NavigationTabs;
