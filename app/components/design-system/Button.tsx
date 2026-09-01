import React, { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export const buttonVariants = cva(
  "relative inline-flex items-center justify-center font-medium transition-all duration-150 ease-in-out cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 enabled:active:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        solid: "shadow-sm",
        outline: "bg-transparent",
        ghost: "bg-transparent border-transparent",
      },
      tone: {
        primary: "focus-visible:ring-primary",
        accent: "focus-visible:ring-accent",
        warning: "focus-visible:ring-warning",
        error: "focus-visible:ring-error",
        success: "focus-visible:ring-success",
        secondary: "focus-visible:ring-stone-400",
      },
      size: {
        sm: "px-3.5 py-2 text-[14px] rounded-lg gap-2",
        md: "px-5 py-3 text-[16px] rounded-xl gap-3",
        lg: "px-6 py-4 text-[16px] rounded-2xl gap-3.5",
      },
      fullWidth: {
        true: "w-full",
        false: "w-auto",
      },
    },
    compoundVariants: [
      // Solid Variants
      {
        variant: "solid",
        tone: "primary",
        className:
          "border-2 border-primary bg-primary text-white enabled:hover:bg-primary-hover enabled:hover:border-primary-hover enabled:active:bg-primary-active",
      },
      {
        variant: "solid",
        tone: "accent",
        className:
          "border-2 border-accent bg-accent text-white enabled:hover:bg-accent-hover enabled:hover:border-accent-hover enabled:active:bg-accent-active",
      },
      {
        variant: "solid",
        tone: "warning",
        className:
          "border-2 border-warning bg-warning text-white enabled:hover:bg-warning-hover enabled:hover:border-warning-hover enabled:active:bg-warning-active",
      },
      {
        variant: "solid",
        tone: "error",
        className:
          "border-2 border-error bg-error text-white enabled:hover:bg-error-hover enabled:hover:border-error-hover enabled:active:bg-error-active",
      },
      {
        variant: "solid",
        tone: "success",
        className:
          "border-2 border-success bg-success text-white enabled:hover:bg-success-hover enabled:hover:border-success-hover enabled:active:bg-success-active",
      },
      {
        variant: "solid",
        tone: "secondary",
        className:
          "border-2 border-stone-300 bg-stone-200 text-stone-900 enabled:hover:bg-stone-100 enabled:hover:border-stone-200 enabled:active:bg-stone-300 enabled:active:border-stone-400 dark:bg-stone-800 dark:border-stone-700 dark:text-stone-100 dark:enabled:hover:bg-stone-700 dark:enabled:active:bg-stone-900",
      },

      // Outline Variants
      {
        variant: "outline",
        tone: "primary",
        className:
          "border-2 border-primary text-primary enabled:hover:bg-primary/10 enabled:active:bg-primary/20",
      },
      {
        variant: "outline",
        tone: "accent",
        className:
          "border-2 border-accent text-accent enabled:hover:bg-accent/10 enabled:active:bg-accent/20",
      },
      {
        variant: "outline",
        tone: "warning",
        className:
          "border-2 border-warning text-warning enabled:hover:bg-warning/10 enabled:active:bg-warning/20",
      },
      {
        variant: "outline",
        tone: "error",
        className:
          "border-2 border-error text-error enabled:hover:bg-error/10 enabled:active:bg-error/20",
      },
      {
        variant: "outline",
        tone: "success",
        className:
          "border-2 border-success text-success enabled:hover:bg-success/10 enabled:active:bg-success/20",
      },
      {
        variant: "outline",
        tone: "secondary",
        className:
          "border-2 border-stone-900 text-stone-900 enabled:hover:bg-stone-100 enabled:active:bg-stone-200 dark:border-stone-200 dark:text-stone-100 dark:enabled:hover:bg-stone-800 dark:enabled:active:bg-stone-900",
      },

      // Ghost Variants
      {
        variant: "ghost",
        tone: "primary",
        className:
          "border-2 border-transparent text-primary enabled:hover:bg-primary/10 enabled:active:bg-primary/20",
      },
      {
        variant: "ghost",
        tone: "accent",
        className:
          "border-2 border-transparent text-accent enabled:hover:bg-accent/10 enabled:active:bg-accent/20",
      },
      {
        variant: "ghost",
        tone: "warning",
        className:
          "border-2 border-transparent text-warning enabled:hover:bg-warning/10 enabled:active:bg-warning/20",
      },
      {
        variant: "ghost",
        tone: "error",
        className:
          "border-2 border-transparent text-error enabled:hover:bg-error/10 enabled:active:bg-error/20",
      },
      {
        variant: "ghost",
        tone: "success",
        className:
          "border-2 border-transparent text-success enabled:hover:bg-success/10 enabled:active:bg-success/20",
      },
      {
        variant: "ghost",
        tone: "secondary",
        className:
          "border-2 border-transparent text-stone-700 enabled:hover:bg-stone-100 enabled:active:bg-stone-200 dark:text-stone-300 dark:enabled:hover:bg-stone-800 dark:enabled:active:bg-stone-900",
      },
    ],
    defaultVariants: {
      variant: "solid",
      tone: "primary",
      size: "md",
      fullWidth: false,
    },
  }
);

export type Tone =
  | "primary"
  | "accent"
  | "warning"
  | "error"
  | "success"
  | "secondary";

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
export type ButtonVariant = NonNullable<ButtonVariantProps["variant"]>;
export type ButtonTone = Tone;
export type ButtonSize = NonNullable<ButtonVariantProps["size"]>;

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "size" | "title">,
    ButtonVariantProps {
  /**
   * Main title text for the button (rendered at 16px text by default)
   */
  title?: string;
  /**
   * Subtitle text displayed below the title
   */
  subtitle?: string;
  /**
   * Leading icon placed before the button text
   */
  leadingIcon?: React.ReactNode;
  /**
   * Trailing icon placed after the button text
   */
  trailingIcon?: React.ReactNode;
  /**
   * Display loading spinner and disable interactions
   */
  isLoading?: boolean;
  /**
   * Child elements if title is not used directly
   */
  children?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      title,
      subtitle,
      leadingIcon,
      trailingIcon,
      variant,
      tone,
      size,
      fullWidth,
      isLoading = false,
      disabled = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;
    const content = title || children;
    const isIconOnly = !content && !subtitle && (Boolean(leadingIcon) || Boolean(trailingIcon) || isLoading);

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          buttonVariants({ variant, tone, size, fullWidth }),
          isIconOnly &&
            (size === "sm"
              ? "p-2 aspect-square"
              : size === "lg"
              ? "p-3.5 aspect-square"
              : "p-2.5 aspect-square"),
          isLoading && "cursor-wait",
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2
            className={cn(
              "animate-spin flex-shrink-0",
              size === "sm" ? "w-4 h-4" : "w-5 h-5"
            )}
          />
        ) : (
          leadingIcon && (
            <span className="flex-shrink-0 inline-flex items-center justify-center">
              {leadingIcon}
            </span>
          )
        )}

        {(content || subtitle) && (
          <span
            className={cn(
              "flex flex-col",
              subtitle ? "text-left items-start" : "items-center"
            )}
          >
            {content && (
              <span className="text-[16px] font-semibold leading-snug tracking-tight">
                {content}
              </span>
            )}
            {subtitle && (
              <span className="text-[12px] opacity-80 font-normal leading-tight mt-0.5">
                {subtitle}
              </span>
            )}
          </span>
        )}

        {trailingIcon && (
          <span className="flex-shrink-0 inline-flex items-center justify-center">
            {trailingIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
