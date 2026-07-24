import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";


export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-full px-6 py-3 text-[15px] font-medium leading-none text-white transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40",
        "bg-[#1d1d1f] shadow-button hover:shadow-button-hover",
        className
      )}
      {...props}
    />
  );
}
