import React, { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export const cardVariants = cva(
  "relative flex flex-col overflow-hidden transition-all duration-200 rounded-lg p-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-sm text-slate-900 dark:text-slate-100"
);

export type CardVariantsProps = VariantProps<typeof cardVariants>;

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    CardVariantsProps {
  asChild?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ asChild = false, className, children, ...props }, ref) => {
    const Component = asChild ? Slot : "div";
    return (
      <Component
        ref={ref}
        className={cn(cardVariants(), className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Card.displayName = "Card";

// ==========================================
// CARD SUBCOMPONENTS
// ==========================================

export const cardHeaderVariants = cva("flex flex-col gap-1.5", {
  variants: {
    bordered: {
      true: "border-b border-slate-100 dark:border-slate-800 pb-4 mb-4",
      false: "",
    },
  },
  defaultVariants: {
    bordered: false,
  },
});

export interface CardHeaderProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardHeaderVariants> {
  asChild?: boolean;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ asChild = false, bordered, className, children, ...props }, ref) => {
    const Component = asChild ? Slot : "div";
    return (
      <Component
        ref={ref}
        className={cn(cardHeaderVariants({ bordered }), className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

CardHeader.displayName = "CardHeader";

export interface CardTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement> {
  asChild?: boolean;
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ asChild = false, className, children, ...props }, ref) => {
    const Component = asChild ? Slot : "h3";
    return (
      <Component
        ref={ref}
        className={cn(
          "text-xl font-bold tracking-tight text-slate-900 dark:text-white",
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

CardTitle.displayName = "CardTitle";

export interface CardDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {
  asChild?: boolean;
}

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  CardDescriptionProps
>(({ asChild = false, className, children, ...props }, ref) => {
  const Component = asChild ? Slot : "p";
  return (
    <Component
      ref={ref}
      className={cn(
        "text-sm text-slate-500 dark:text-slate-400 leading-relaxed",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
});

CardDescription.displayName = "CardDescription";

export interface CardContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ asChild = false, className, children, ...props }, ref) => {
    const Component = asChild ? Slot : "div";
    return (
      <Component ref={ref} className={cn("flex-1", className)} {...props}>
        {children}
      </Component>
    );
  }
);

CardContent.displayName = "CardContent";

export const cardFooterVariants = cva("flex items-center gap-3", {
  variants: {
    bordered: {
      true: "border-t border-slate-100 dark:border-slate-800 pt-4 mt-4",
      false: "mt-4",
    },
    align: {
      left: "justify-start",
      center: "justify-center",
      right: "justify-end",
      between: "justify-between",
    },
  },
  defaultVariants: {
    bordered: false,
    align: "left",
  },
});

export interface CardFooterProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardFooterVariants> {
  asChild?: boolean;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ asChild = false, bordered, align, className, children, ...props }, ref) => {
    const Component = asChild ? Slot : "div";
    return (
      <Component
        ref={ref}
        className={cn(cardFooterVariants({ bordered, align }), className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

CardFooter.displayName = "CardFooter";

export default Card;
