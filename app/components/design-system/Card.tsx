import React, { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export const cardVariants = cva(
  "relative flex flex-col overflow-hidden transition-all duration-200 rounded-lg p-4 bg-surface-light text-font dark:bg-surface-dark dark:text-surface",
  {
    variants: {
      elevation: {
        low: "shadow-low",
        mid: "shadow-mid",
        high: "shadow-high",
      },
    },
    defaultVariants: {
      elevation: "mid",
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
  ({ asChild = false, elevation, className, children, ...props }, ref) => {
    const Component = asChild ? Slot : "div";
    return (
      <Component
        ref={ref}
        className={cn(cardVariants({ elevation }), className)}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Card.displayName = "Card";

export default Card;
