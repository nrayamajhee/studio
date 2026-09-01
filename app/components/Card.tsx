import React, { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

export const cardVariants = cva(
  "relative flex flex-col overflow-hidden transition-all duration-200 text-slate-900 dark:text-slate-100",
  {
    variants: {
      variant: {
        default:
          "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm",
        bordered:
          "bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-sm",
        elevated:
          "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl",
        ghost:
          "bg-transparent border-2 border-transparent hover:bg-slate-100/50 dark:hover:bg-slate-900/50",
        interactive:
          "bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg hover:border-indigo-500 dark:hover:border-indigo-400 cursor-pointer transform hover:-translate-y-0.5",
        gradient:
          "bg-gradient-to-br from-white via-slate-50 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40 border-2 border-slate-200 dark:border-slate-800 shadow-md",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
        xl: "p-10",
      },
      rounded: {
        none: "rounded-none",
        md: "rounded-xl",
        lg: "rounded-2xl",
        xl: "rounded-3xl",
      },
    },
    defaultVariants: {
      variant: "bordered",
      padding: "md",
      rounded: "xl",
    },
  }
);

export type CardVariantsProps = VariantProps<typeof cardVariants>;

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    CardVariantsProps {
  as?: React.ElementType;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant, padding, rounded, as = "div", className, children, ...props }, ref) => {
    const Component = as;
    return (
      <Component
        ref={ref}
        className={cn(cardVariants({ variant, padding, rounded }), className)}
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
    VariantProps<typeof cardHeaderVariants> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ bordered, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardHeaderVariants({ bordered }), className)}
      {...props}
    >
      {children}
    </div>
  )
);

CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-bold tracking-tight text-slate-900 dark:text-white",
      className
    )}
    {...props}
  >
    {children}
  </h3>
));

CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-sm text-slate-500 dark:text-slate-400 leading-relaxed",
      className
    )}
    {...props}
  >
    {children}
  </p>
));

CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("flex-1", className)} {...props}>
    {children}
  </div>
));

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
    VariantProps<typeof cardFooterVariants> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ bordered, align, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardFooterVariants({ bordered, align }), className)}
      {...props}
    >
      {children}
    </div>
  )
);

CardFooter.displayName = "CardFooter";

export default Card;
