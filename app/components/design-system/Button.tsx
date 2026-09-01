import React, { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Paragraph, Caption } from "./Typography";

export const buttonVariants = cva(
  "relative inline-flex items-center font-medium border-2 transition-colors duration-150 ease-in-out cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:pointer-events-none",
  {
    variants: {
      variant: {
        solid: "shadow-sm border-transparent",
        outline: "bg-transparent border-current",
        ghost: "bg-transparent border-transparent",
      },
      tone: {
        primary: "focus-visible:ring-primary",
        accent: "focus-visible:ring-accent",
        warning: "focus-visible:ring-warning",
        error: "focus-visible:ring-error",
        success: "focus-visible:ring-success",
        secondary: "focus-visible:ring-font-light",
      },
      size: {
        sm: "px-3.5 py-2 text-xs rounded-lg gap-2",
        md: "px-5 py-3 text-sm rounded-xl gap-3",
        lg: "px-6 py-4 text-base rounded-2xl gap-3.5",
      },
      rounded: {
        true: "rounded-full",
        false: "",
      },
      fullWidth: {
        true: "w-full",
        false: "w-auto",
      },
      align: {
        left: "justify-start text-left",
        center: "justify-center text-center",
        right: "justify-end text-right",
        between: "justify-between text-left",
      },
    },
    compoundVariants: [
      {
        variant: "solid",
        tone: "primary",
        className:
          "bg-primary text-white hover:bg-primary-light active:bg-primary-dark",
      },
      {
        variant: "solid",
        tone: "accent",
        className:
          "bg-accent text-white hover:bg-accent-light active:bg-accent-dark",
      },
      {
        variant: "solid",
        tone: "warning",
        className:
          "bg-warning text-white hover:bg-warning-light active:bg-warning-dark",
      },
      {
        variant: "solid",
        tone: "error",
        className:
          "bg-error text-white hover:bg-error-light active:bg-error-dark",
      },
      {
        variant: "solid",
        tone: "success",
        className:
          "bg-success text-white hover:bg-success-light active:bg-success-dark",
      },
      {
        variant: "solid",
        tone: "secondary",
        className:
          "bg-surface text-font hover:bg-surface-light active:bg-stone-200 dark:bg-stone-800 dark:text-surface dark:hover:bg-stone-700 dark:active:bg-surface-dark",
      },

      {
        variant: ["outline", "ghost"],
        tone: "primary",
        className: "text-primary hover:bg-primary/10 active:bg-primary/20",
      },
      {
        variant: ["outline", "ghost"],
        tone: "accent",
        className: "text-accent hover:bg-accent/10 active:bg-accent/20",
      },
      {
        variant: ["outline", "ghost"],
        tone: "warning",
        className: "text-warning hover:bg-warning/10 active:bg-warning/20",
      },
      {
        variant: ["outline", "ghost"],
        tone: "error",
        className: "text-error hover:bg-error/10 active:bg-error/20",
      },
      {
        variant: ["outline", "ghost"],
        tone: "success",
        className: "text-success hover:bg-success/10 active:bg-success/20",
      },
      {
        variant: ["outline", "ghost"],
        tone: "secondary",
        className:
          "text-font hover:bg-font/10 active:bg-font/20 dark:text-surface dark:hover:bg-surface/10 dark:active:bg-surface/20",
      },
    ],
    defaultVariants: {
      variant: "solid",
      tone: "primary",
      size: "md",
      rounded: false,
      fullWidth: false,
      align: "center",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export type Tone =
  "primary" | "accent" | "warning" | "error" | "success" | "secondary";

export type ButtonTone = Tone;
export type ButtonVariant = NonNullable<ButtonVariantProps["variant"]>;
export type ButtonSize = NonNullable<ButtonVariantProps["size"]>;
export type ButtonAlign = NonNullable<ButtonVariantProps["align"]>;

export interface ButtonProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "size">,
    ButtonVariantProps {
  asChild?: boolean;
  title?: string;
  subtitle?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild = false,
      title,
      subtitle,
      leadingIcon,
      trailingIcon,
      variant,
      tone,
      size,
      rounded,
      fullWidth,
      align,
      isLoading = false,
      disabled = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const Component = asChild ? Slot : "button";
    const isDisabled = disabled || isLoading;
    const content = title || children;
    const isIconOnly =
      !content &&
      !subtitle &&
      (Boolean(leadingIcon) || Boolean(trailingIcon) || isLoading);

    return (
      <Component
        ref={ref}
        disabled={asChild ? undefined : isDisabled}
        aria-disabled={asChild && isDisabled ? true : undefined}
        className={cn(
          buttonVariants({ variant, tone, size, rounded, fullWidth, align }),
          isIconOnly &&
            (size === "sm"
              ? "p-2 aspect-square"
              : size === "lg"
                ? "p-3.5 aspect-square"
                : "p-2.5 aspect-square"),
          isLoading && "cursor-wait",
          className,
        )}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {isLoading ? (
              <Loader2
                className={cn(
                  "animate-spin flex-shrink-0",
                  size === "sm" ? "w-4 h-4" : "w-5 h-5",
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
                  subtitle
                    ? "text-left items-start"
                    : align === "right"
                      ? "items-end text-right"
                      : align === "left" || align === "between"
                        ? "items-start text-left"
                        : "items-center",
                )}
              >
                {content && (
                  <Paragraph
                    asChild
                    className="font-semibold leading-snug tracking-tight text-inherit dark:text-inherit"
                  >
                    <span>{content}</span>
                  </Paragraph>
                )}
                {subtitle && (
                  <Caption
                    asChild
                    className="opacity-80 font-normal leading-tight mt-0.5 text-inherit dark:text-inherit"
                  >
                    <span>{subtitle}</span>
                  </Caption>
                )}
              </span>
            )}

            {trailingIcon && (
              <span className="flex-shrink-0 inline-flex items-center justify-center">
                {trailingIcon}
              </span>
            )}
          </>
        )}
      </Component>
    );
  },
);

Button.displayName = "Button";
export default Button;
