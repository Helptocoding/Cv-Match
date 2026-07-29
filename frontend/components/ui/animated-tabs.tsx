"use client";

import { motion } from "framer-motion";


type Tab = {
  id: string;
  label: string;
};

type Props = {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
};


export function AnimatedTabs({ tabs, activeTab, onChange, className }: Props) {
  return (
    <div className={className}>
      <div className="relative flex gap-0.5 rounded-full bg-black/[0.04] p-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className="relative px-3 py-1.5 text-xs font-medium outline-none transition-colors duration-200"
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="active-tab"
                className="absolute inset-0 rounded-full bg-white shadow-sm"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className={activeTab === tab.id ? "relative z-10 text-ink" : "relative z-10 text-black/50 hover:text-black/75"}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
