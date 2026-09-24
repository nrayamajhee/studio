import React, { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export const cardVariants = cva(
  "relative flex flex-col overflow-hidden transition-all duration-200 rounded-lg p-4 text-font dark:text-surface",
  {
    variants: {
      variant: {
        solid: "bg-surface-light dark:bg-surface-dark",
        glass:
          "border-2 border-white/45 bg-white/20 backdrop-blur-xl dark:border-white/15 dark:bg-stone-950/20",
      },
      elevation: {
        low: "shadow-low",
        mid: "shadow-mid",
        high: "shadow-high",
      },
    },
    defaultVariants: {
      variant: "glass",
      elevation: "low",
    },
  },
);

export type CardVariantsProps = VariantProps<typeof cardVariants>;
export type CardElevation = NonNullable<CardVariantsProps["elevation"]>;

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, CardVariantsProps {
  asChild?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { asChild = false, variant, elevation, className, children, ...props },
    ref,
  ) => {
    const Component = asChild ? Slot : "div";
    return (
      <Component
        ref={ref}
        className={cn(cardVariants({ variant, elevation }), className)}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Card.displayName = "Card";
