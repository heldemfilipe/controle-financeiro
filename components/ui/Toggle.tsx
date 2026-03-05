"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function Toggle({ checked, onChange, disabled, size = "md" }: ToggleProps) {
  const w = size === "sm" ? "w-8 h-4" : "w-10 h-5";
  const dot = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const translate = size === "sm" ? "translate-x-4" : "translate-x-5";

  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex items-center ${w} rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? "bg-emerald-500" : "bg-slate-300"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block ${dot} bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ml-0.5 ${
          checked ? translate : "translate-x-0"
        }`}
      />
    </button>
  );
}
