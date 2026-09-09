import React, { useState, useId } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  Button,
  buttonVariants,
  type ButtonVariant,
  type ButtonTone,
  type ButtonSize,
} from "./Button";
import { Card } from "./Card";
import { Label } from "./Typography";

export const dropdownVariants = buttonVariants;
export type DropdownVariantProps = {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
};

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
  variant = "solid",
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

  const buttonTone: ButtonTone =
    variant === "solid" && (tone === "primary" || tone === "accent")
      ? "secondary"
      : tone || "secondary";

  return (
    <div className={cn("w-full flex flex-col", className)}>
      {label && (
        <Label asChild>
          <label
            htmlFor={id}
            className={cn(
              "font-medium text-stone-700 dark:text-stone-300 truncate block",
              size === "xs" ? "text-[9px] mb-0.5 leading-tight" : "text-[10px] mb-1",
            )}
          >
            {label}
          </label>
        </Label>
      )}

      <Popover.Root open={open} onOpenChange={disabled ? undefined : setOpen}>
        <Popover.Trigger asChild disabled={disabled}>
          <Button
            id={id}
            variant={variant}
            tone={buttonTone}
            size={size}
            fullWidth
            align="between"
            disabled={disabled}
            aria-label={label || displayLabel}
            aria-expanded={open}
            trailingIcon={
              <ChevronDown
                className={cn(
                  "flex-shrink-0 transition-transform duration-150 opacity-60",
                  open && "rotate-180",
                  size === "xs" ? "w-3 h-3" : size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5",
                )}
              />
            }
            className={cn(
              "w-full select-none",
              size === "xs" && "h-6.5 text-[11px] px-2 py-0",
              tone === "primary" &&
                "focus-visible:ring-primary data-[state=open]:ring-2 data-[state=open]:ring-primary",
              tone === "accent" &&
                "focus-visible:ring-accent data-[state=open]:ring-2 data-[state=open]:ring-accent",
              triggerClassName,
            )}
          >
            {displayLabel}
          </Button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            asChild
            align={align}
            side={side}
            sideOffset={sideOffset}
          >
            <Card
              elevation="high"
              className={cn(
                "z-50 min-w-[var(--radix-popover-trigger-width)] max-h-56 overflow-y-auto rounded-lg p-1 text-xs shadow-xl backdrop-blur-md outline-none",
                "bg-white/95 dark:bg-stone-900/95 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100",
                contentClassName,
              )}
            >
              <div className="space-y-0.5">
                {normalizedOptions.map((opt) => {
                  const isSelected = String(opt.value) === String(currentValue);

                  return (
                    <Button
                      key={opt.value}
                      variant="ghost"
                      tone="secondary"
                      size="xs"
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt.value)}
                      className={cn(
                        "w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] font-sans font-medium transition-colors text-left select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-0 shadow-none",
                        isSelected
                          ? "bg-primary text-white font-bold shadow-sm hover:bg-primary"
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
                    </Button>
                  );
                })}
              </div>
            </Card>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};

export default Dropdown;
