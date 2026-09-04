import React, { forwardRef, useId } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export const sliderVariants = cva(
  "w-full appearance-none rounded-lg cursor-pointer transition-all focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      tone: {
        primary:
          "accent-primary focus-visible:ring-2 focus-visible:ring-primary",
        accent:
          "accent-[#d4a359] focus-visible:ring-2 focus-visible:ring-[#d4a359]",
        secondary:
          "accent-stone-400 focus-visible:ring-2 focus-visible:ring-stone-400",
      },
      size: {
        sm: "h-1",
        md: "h-1.5",
        lg: "h-2",
      },
    },
    defaultVariants: {
      tone: "accent",
      size: "sm",
    },
  },
);

export type SliderVariantProps = VariantProps<typeof sliderVariants>;

export interface SliderProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "onChange">,
    SliderVariantProps {
  label?: string;
  valueDisplay?: string | number;
  onChange?: (
    value: number,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => void;
  showFill?: boolean;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      className,
      label,
      valueDisplay,
      min = 0,
      max = 100,
      step = 1,
      value,
      defaultValue,
      onChange,
      tone = "accent",
      size = "sm",
      id: customId,
      showFill = true,
      style,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const id = customId || generatedId;

    const currentVal =
      value !== undefined
        ? Number(value)
        : defaultValue !== undefined
          ? Number(defaultValue)
          : Number(min);
    const minNum = Number(min);
    const maxNum = Number(max);
    const range = maxNum - minNum || 1;
    const percentage = Math.max(
      0,
      Math.min(100, ((currentVal - minNum) / range) * 100),
    );

    const toneFillColors = {
      primary: "#2563eb",
      accent: "#d4a359",
      secondary: "#71717a",
    };

    const fillColor = toneFillColors[tone || "accent"];
    const trackColor = "#232a3b";

    const fillStyle: React.CSSProperties = showFill
      ? {
          background: `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${percentage}%, ${trackColor} ${percentage}%, ${trackColor} 100%)`,
          ...style,
        }
      : {
          backgroundColor: trackColor,
          ...style,
        };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(parseFloat(e.target.value), e);
      }
    };

    return (
      <div className="w-full flex flex-col">
        {(label || valueDisplay !== undefined) && (
          <div className="flex justify-between items-center text-[10px] mb-1">
            {label && (
              <label
                htmlFor={id}
                className="font-medium text-[#858b9c] dark:text-[#858b9c] truncate"
              >
                {label}
              </label>
            )}
            {valueDisplay !== undefined && (
              <span className="font-mono font-semibold text-stone-700 dark:text-[#e6e8ec] ml-2 flex-shrink-0">
                {valueDisplay}
              </span>
            )}
          </div>
        )}

        <input
          ref={ref}
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          disabled={disabled}
          style={fillStyle}
          className={cn(sliderVariants({ tone, size }), className)}
          {...props}
        />
      </div>
    );
  },
);

Slider.displayName = "Slider";

export default Slider;
