import React, { forwardRef, useId } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export const dropdownVariants = cva(
  "w-full appearance-none transition-colors duration-150 font-medium cursor-pointer border rounded-lg focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      tone: {
        accent:
          "bg-[#0a0d14] text-[#e6e8ec] border-[#232a3b] focus-visible:border-[#d4a359] focus-visible:ring-1 focus-visible:ring-[#d4a359]",
        primary:
          "bg-surface text-font border-stone-300 dark:bg-stone-900 dark:text-stone-100 dark:border-stone-700 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary",
        secondary:
          "bg-stone-100 text-stone-800 border-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-700 focus-visible:border-stone-400 focus-visible:ring-1 focus-visible:ring-stone-400",
      },
      size: {
        sm: "py-1 pl-2.5 pr-7 text-[11px]",
        md: "py-2 pl-3.5 pr-8 text-xs",
        lg: "py-2.5 pl-4 pr-10 text-sm",
      },
    },
    defaultVariants: {
      tone: "accent",
      size: "sm",
    },
  },
);

export type DropdownVariantProps = VariantProps<typeof dropdownVariants>;

export interface DropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface DropdownProps
  extends
    Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size" | "onChange">,
    DropdownVariantProps {
  label?: string;
  options: Array<DropdownOption | string>;
  onChange?: (
    value: string,
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => void;
  placeholder?: string;
}

export const Dropdown = forwardRef<HTMLSelectElement, DropdownProps>(
  (
    {
      className,
      label,
      options,
      value,
      defaultValue,
      onChange,
      tone = "accent",
      size = "sm",
      id: customId,
      disabled,
      placeholder,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const id = customId || generatedId;

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (onChange) {
        onChange(e.target.value, e);
      }
    };

    const iconSizes = {
      sm: "w-3 h-3 right-2",
      md: "w-3.5 h-3.5 right-2.5",
      lg: "w-4 h-4 right-3",
    };

    return (
      <div className="w-full flex flex-col">
        {label && (
          <label
            htmlFor={id}
            className="text-[10px] font-medium text-[#858b9c] dark:text-[#858b9c] mb-1 truncate block"
          >
            {label}
          </label>
        )}

        <div className="relative w-full flex items-center">
          <select
            ref={ref}
            id={id}
            value={value}
            defaultValue={defaultValue}
            onChange={handleChange}
            disabled={disabled}
            className={cn(dropdownVariants({ tone, size }), className)}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => {
              const optValue = typeof opt === "string" ? opt : opt.value;
              const optLabel = typeof opt === "string" ? opt : opt.label;
              const optDisabled =
                typeof opt === "string" ? false : opt.disabled;

              return (
                <option key={optValue} value={optValue} disabled={optDisabled}>
                  {optLabel}
                </option>
              );
            })}
          </select>

          <ChevronDown
            className={cn(
              "absolute pointer-events-none opacity-60 text-current",
              iconSizes[size || "sm"],
            )}
          />
        </div>
      </div>
    );
  },
);

Dropdown.displayName = "Dropdown";

export default Dropdown;
