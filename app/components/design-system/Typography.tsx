import React, { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

// ==========================================
// 1. TITLE COMPONENT
// Slightly larger than 16px baseline paragraph
// ==========================================

export const titleVariants = cva("font-bold tracking-tight transition-colors", {
  variants: {
    size: {
      default: "text-[20px] leading-snug",
      sm: "text-[18px] leading-snug",
      md: "text-[20px] leading-snug",
      lg: "text-[24px] leading-tight",
      xl: "text-[28px] leading-tight",
      "2xl": "text-[32px] leading-tight",
    },
    color: {
      primary: "text-[#1c1917] dark:text-[#fdfbf7]",
      secondary: "text-[#78716c] dark:text-[#a8a29e]",
      muted: "text-[#a8a29e] dark:text-[#78716c]",
    },
    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
  },
  defaultVariants: {
    size: "default",
    color: "primary",
    align: "left",
  },
});

export type TitleLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type TitleVariantsProps = VariantProps<typeof titleVariants>;

export interface TitleProps
  extends Omit<React.HTMLAttributes<HTMLHeadingElement>, "color">,
    TitleVariantsProps {
  level?: TitleLevel;
  asChild?: boolean;
  children: React.ReactNode;
}

export const Title = forwardRef<HTMLHeadingElement, TitleProps>(
  (
    {
      level = 2,
      size,
      color,
      align,
      asChild = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Component = asChild ? Slot : (`h${level}` as React.ElementType);

    return (
      <Component
        ref={ref}
        className={cn(titleVariants({ size, color, align }), className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Title.displayName = "Title";

// ==========================================
// 2. SUBTITLE COMPONENT
// Same 16px size as baseline paragraph, font-medium
// ==========================================

export const subtitleVariants = cva(
  "text-[16px] leading-[1.5] font-medium transition-colors",
  {
    variants: {
      color: {
        primary: "text-[#1c1917] dark:text-[#fdfbf7]",
        secondary: "text-[#78716c] dark:text-[#a8a29e]",
        muted: "text-[#a8a29e] dark:text-[#78716c]",
      },
      align: {
        left: "text-left",
        center: "text-center",
        right: "text-right",
      },
    },
    defaultVariants: {
      color: "primary",
      align: "left",
    },
  }
);

export type SubtitleVariantsProps = VariantProps<typeof subtitleVariants>;

export interface SubtitleProps
  extends Omit<React.HTMLAttributes<HTMLParagraphElement>, "color">,
    SubtitleVariantsProps {
  asChild?: boolean;
  children: React.ReactNode;
}

export const Subtitle = forwardRef<HTMLParagraphElement, SubtitleProps>(
  ({ color, align, asChild = false, className, children, ...props }, ref) => {
    const Component = asChild ? Slot : "p";
    return (
      <Component
        ref={ref}
        className={cn(subtitleVariants({ color, align }), className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Subtitle.displayName = "Subtitle";

// ==========================================
// 3. PARAGRAPH COMPONENT
// Baseline 16px font size with 1.5 line-height
// ==========================================

export const paragraphVariants = cva(
  "text-[16px] leading-[1.5] font-normal transition-colors",
  {
    variants: {
      color: {
        primary: "text-[#1c1917] dark:text-[#fdfbf7]",
        secondary: "text-[#78716c] dark:text-[#a8a29e]",
        muted: "text-[#a8a29e] dark:text-[#78716c]",
      },
      align: {
        left: "text-left",
        center: "text-center",
        right: "text-right",
      },
    },
    defaultVariants: {
      color: "primary",
      align: "left",
    },
  }
);

export type ParagraphVariantsProps = VariantProps<typeof paragraphVariants>;

export interface ParagraphProps
  extends Omit<React.HTMLAttributes<HTMLParagraphElement>, "color">,
    ParagraphVariantsProps {
  asChild?: boolean;
  children: React.ReactNode;
}

export const Paragraph = forwardRef<HTMLParagraphElement, ParagraphProps>(
  ({ color, align, asChild = false, className, children, ...props }, ref) => {
    const Component = asChild ? Slot : "p";
    return (
      <Component
        ref={ref}
        className={cn(paragraphVariants({ color, align }), className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Paragraph.displayName = "Paragraph";

// ==========================================
// 4. LABEL COMPONENT
// Smaller than p (14px) with gray text
// ==========================================

export const labelVariants = cva(
  "inline-flex items-center gap-1.5 text-[14px] leading-normal font-medium text-[#78716c] dark:text-[#a8a29e] select-none transition-colors",
  {
    variants: {
      color: {
        primary: "text-[#1c1917] dark:text-[#fdfbf7]",
        secondary: "text-[#78716c] dark:text-[#a8a29e]",
        muted: "text-[#a8a29e] dark:text-[#78716c]",
      },
    },
    defaultVariants: {
      color: "secondary",
    },
  }
);

export type LabelVariantsProps = VariantProps<typeof labelVariants>;

export interface LabelProps
  extends Omit<React.LabelHTMLAttributes<HTMLLabelElement>, "color">,
    LabelVariantsProps {
  required?: boolean;
  optional?: boolean;
  asChild?: boolean;
  children: React.ReactNode;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  (
    {
      color,
      required = false,
      optional = false,
      asChild = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Component = asChild ? Slot : "label";
    return (
      <Component
        ref={ref}
        className={cn(labelVariants({ color }), className)}
        {...props}
      >
        <span>{children}</span>
        {required && (
          <span
            className="text-rose-500 dark:text-rose-400 font-bold"
            aria-hidden="true"
          >
            *
          </span>
        )}
        {optional && (
          <span className="text-[12px] font-normal text-[#a8a29e] dark:text-[#78716c]">
            (optional)
          </span>
        )}
      </Component>
    );
  }
);

Label.displayName = "Label";

// ==========================================
// 5. CAPTION COMPONENT
// Smaller than label (12px) with gray text
// ==========================================

export const captionVariants = cva(
  "inline-block text-[12px] leading-normal font-normal text-[#a8a29e] dark:text-[#78716c] transition-colors",
  {
    variants: {
      color: {
        primary: "text-[#1c1917] dark:text-[#fdfbf7]",
        secondary: "text-[#78716c] dark:text-[#a8a29e]",
        muted: "text-[#a8a29e] dark:text-[#78716c]",
      },
    },
    defaultVariants: {
      color: "muted",
    },
  }
);

export type CaptionVariantsProps = VariantProps<typeof captionVariants>;

export interface CaptionProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    CaptionVariantsProps {
  asChild?: boolean;
  children: React.ReactNode;
}

export const Caption = forwardRef<HTMLSpanElement, CaptionProps>(
  ({ color, asChild = false, className, children, ...props }, ref) => {
    const Component = asChild ? Slot : "span";
    return (
      <Component
        ref={ref}
        className={cn(captionVariants({ color }), className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Caption.displayName = "Caption";

// Group export
export const Typography = {
  Title,
  Subtitle,
  Paragraph,
  Label,
  Caption,
};

export default Typography;
