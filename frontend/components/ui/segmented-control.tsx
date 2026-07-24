"use client";

import clsx from "clsx";


type SegmentedControlProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  return (
    <div>
      {label && (
        <p className="mb-3 text-xs font-medium tracking-[0.04em] text-black/50">
          {label}
        </p>
      )}
      <div className="relative flex rounded-[11px] bg-black/[0.06] p-[3px]">
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={clsx(
                "relative z-10 cursor-pointer select-none rounded-[9px] px-4 py-[7px] text-center text-[13px] font-medium leading-none transition-all duration-200",
                selected
                  ? "text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]"
                  : "text-black/50 hover:text-black/80"
              )}
            >
              <span className={clsx(
                "relative",
                selected && "font-semibold"
              )}>
                {option}
              </span>
              {selected && (
                <span className="absolute inset-0 -z-10 rounded-[9px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.10),0_1px_2px_rgba(0,0,0,0.04)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
