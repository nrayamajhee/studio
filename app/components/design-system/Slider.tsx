import React, { forwardRef, useId } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export const sliderVariants = cva(
  "custom-slider appearance-none cursor-pointer transition-all focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      tone: {
        primary: "focus-visible:ring-2 focus-visible:ring-primary/40",
        accent: "focus-visible:ring-2 focus-visible:ring-[#d4a359]/40",
        secondary: "focus-visible:ring-2 focus-visible:ring-stone-400/40",
      },
      size: {
        sm: "",
        md: "",
        lg: "",
      },
    },
    defaultVariants: {
      tone: "primary",
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
      tone = "primary",
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

    const toneConfigs = {
      primary: {
        fill: "var(--color-primary, #2554d7)",
        gutter: "var(--slider-gutter-primary)",
        thumbBorder: "var(--color-primary, #2554d7)",
      },
      accent: {
        fill: "#d4a359",
        gutter: "var(--slider-gutter-accent)",
        thumbBorder: "#d4a359",
      },
      secondary: {
        fill: "#78716c",
        gutter: "var(--slider-gutter-secondary)",
        thumbBorder: "#78716c",
      },
    };

    const sizeConfigs = {
      sm: {
        trackHeight: "6px",
        trackRadius: "4px",
        thumbSize: "14px",
      },
      md: {
        trackHeight: "8px",
        trackRadius: "5px",
        thumbSize: "16px",
      },
      lg: {
        trackHeight: "10px",
        trackRadius: "6px",
        thumbSize: "18px",
      },
    };

    const toneConfig = toneConfigs[tone || "primary"] || toneConfigs.primary;
    const sizeConfig = sizeConfigs[size || "sm"] || sizeConfigs.sm;

    const fillStyle: React.CSSProperties = {
      "--slider-progress": showFill ? `${percentage}%` : "0%",
      "--slider-fill": toneConfig.fill,
      "--slider-gutter": toneConfig.gutter,
      "--slider-thumb-border": toneConfig.thumbBorder,
      "--slider-track-height": sizeConfig.trackHeight,
      "--slider-track-radius": sizeConfig.trackRadius,
      "--slider-thumb-size": sizeConfig.thumbSize,
      ...style,
    } as React.CSSProperties;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(parseFloat(e.target.value), e);
      }
    };

    return (
      <div
        className={cn(
          "flex flex-col justify-center",
          label || valueDisplay !== undefined ? "w-full" : "w-auto",
        )}
      >
        {(label || valueDisplay !== undefined) && (
          <div className="flex justify-between items-center text-[10px] mb-1">
            {label && (
              <label
                htmlFor={id}
                className="font-medium text-stone-700 dark:text-[#858b9c] truncate"
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
