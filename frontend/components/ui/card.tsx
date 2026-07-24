import type { ReactNode } from "react";
import clsx from "clsx";


export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={clsx(
      "rounded-2xl border border-black/[0.06] bg-white/80 p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_4px_24px_rgba(0,0,0,0.09),0_2px_6px_rgba(0,0,0,0.05)]",
      className
    )}>
      {children}
    </section>
  );
}
