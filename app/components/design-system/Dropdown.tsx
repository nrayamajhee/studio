import React, { useState, useId } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../../lib/utils";

export const dropdownVariants = cva(
  "w-full flex items-center justify-between transition-colors duration-150 font-medium cursor-pointer border rounded-lg focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed select-none",
  {
    variants: {
      tone: {
        accent:
          "bg-[#0a0d14] text-[#e6e8ec] border-[#232a3b] hover:border-[#38435d] focus-visible:border-[#d4a359] focus-visible:ring-1 focus-visible:ring-[#d4a359] data-[state=open]:border-[#d4a359]",
        primary:
          "bg-surface text-font border-stone-300 dark:bg-stone-900 dark:text-stone-100 dark:border-stone-700 hover:border-stone-400 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary data-[state=open]:border-primary",
        secondary:
          "bg-stone-100 text-stone-800 border-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-700 hover:border-stone-300 focus-visible:border-stone-400 focus-visible:ring-1 focus-visible:ring-stone-400 data-[state=open]:border-stone-400",
      },
      size: {
        xs: "h-6 py-0.5 pl-2 pr-2 text-[10px]",
        sm: "h-8 py-1 pl-2.5 pr-2.5 text-[11px]",
        md: "h-9 py-2 pl-3.5 pr-3 text-xs",
        lg: "h-10 py-2.5 pl-4 pr-3.5 text-sm",
      },
    },
    defaultVariants: {
      tone: "primary",
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

export interface DropdownProps extends DropdownVariantProps {
  id?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  label?: string;
  options: Array<DropdownOption | string>;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
}

export const Dropdown: React.FC<DropdownProps> = ({
  className,
  triggerClassName,
  contentClassName,
  label,
  options,
  value,
  defaultValue,
  onChange,
  tone = "primary",
  size = "sm",
  id: customId,
  disabled,
  placeholder,
  align = "start",
  side = "bottom",
  sideOffset = 4,
}) => {
  const generatedId = useId();
  const id = customId || generatedId;

  const [internalValue, setInternalValue] = useState<string | number>(() => {
    if (value !== undefined) return value;
    if (defaultValue !== undefined) return defaultValue;
    const first = options[0];
    return typeof first === "string" ? first : first ? first.value : "";
  });

  const [open, setOpen] = useState(false);

  const currentValue = value !== undefined ? value : internalValue;

  const normalizedOptions: DropdownOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt,
  );

  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(currentValue),
  );

  const displayLabel = selectedOption
    ? selectedOption.label
    : placeholder || (normalizedOptions[0]?.label ?? "");

  const handleSelect = (optValue: string | number) => {
    if (value === undefined) {
      setInternalValue(optValue);
    }
    if (onChange) {
      onChange(String(optValue));
    }
    setOpen(false);
  };

  return (
    <div className={cn("w-full flex flex-col", className)}>
      {label && (
        <label
          htmlFor={id}
          className="text-[10px] font-medium text-stone-700 dark:text-stone-300 mb-1 truncate block"
        >
          {label}
        </label>
      )}

      <Popover.Root open={open} onOpenChange={disabled ? undefined : setOpen}>
        <Popover.Trigger asChild disabled={disabled}>
          <button
            type="button"
            id={id}
            aria-label={label || displayLabel}
            aria-expanded={open}
            className={cn(
              dropdownVariants({ tone, size }),
              triggerClassName,
            )}
          >
            <span className="truncate pr-1 text-left flex-1 font-mono">
              {displayLabel}
            </span>
            <ChevronDown
              className={cn(
                "flex-shrink-0 transition-transform duration-150 opacity-60",
                open && "rotate-180",
                size === "xs" ? "w-2.5 h-2.5" : "w-3.5 h-3.5",
              )}
            />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align={align}
            side={side}
            sideOffset={sideOffset}
            className={cn(
              "z-50 min-w-[var(--radix-popover-trigger-width)] max-h-56 overflow-y-auto rounded-lg p-1 text-xs shadow-xl backdrop-blur-md outline-none",
              tone === "accent" &&
                "bg-[#0a0d14]/95 border border-[#232a3b] text-stone-200",
              tone === "primary" &&
                "bg-white/95 dark:bg-stone-900/95 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100",
              tone === "secondary" &&
                "bg-stone-50/95 dark:bg-stone-800/95 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100",
              contentClassName,
            )}
          >
            <div className="space-y-0.5">
              {normalizedOptions.map((opt) => {
                const isSelected = String(opt.value) === String(currentValue);

                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1 rounded text-[11px] font-mono transition-colors text-left select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                      isSelected
                        ? tone === "accent"
                          ? "bg-[#d4a359] text-stone-950 font-bold shadow-sm"
                          : "bg-primary text-white font-bold shadow-sm"
                        : tone === "accent"
                          ? "text-stone-300 hover:bg-[#181f2c] hover:text-white"
                          : "text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-white",
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && (
                      <Check
                        className={cn(
                          "w-3 h-3 flex-shrink-0 ml-1.5",
                          tone === "accent" ? "text-stone-950" : "text-white",
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};

export default Dropdown;
