import React, { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

// ==========================================
// 1. TITLE COMPONENT WITH CVA
// ==========================================

export const titleVariants = cva("tracking-tight transition-colors", {
  variants: {
    size: {
      display: "text-4xl sm:text-6xl tracking-tight leading-[1.1]",
      "4xl": "text-3xl sm:text-5xl tracking-tight leading-tight",
      "3xl": "text-2xl sm:text-4xl tracking-tight leading-tight",
      "2xl": "text-xl sm:text-3xl tracking-snug leading-snug",
      xl: "text-lg sm:text-2xl tracking-snug leading-snug",
      lg: "text-base sm:text-xl tracking-normal leading-normal",
      md: "text-base sm:text-lg tracking-normal leading-normal",
      sm: "text-sm sm:text-base tracking-normal leading-normal",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
      extrabold: "font-extrabold",
      black: "font-black",
    },
    color: {
      default: "text-slate-900 dark:text-white",
      muted: "text-slate-600 dark:text-slate-400",
      primary: "text-indigo-600 dark:text-indigo-400",
      gradient:
        "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent",
      inverse: "text-white",
    },
    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
  },
  defaultVariants: {
    weight: "bold",
    color: "default",
    align: "left",
  },
});

export type TitleLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type TitleVariantsProps = VariantProps<typeof titleVariants>;

const defaultSizeByLevel: Record<TitleLevel, NonNullable<TitleVariantsProps["size"]>> = {
  1: "4xl",
  2: "3xl",
  3: "2xl",
  4: "xl",
  5: "lg",
  6: "md",
};

export interface TitleProps
  extends Omit<React.HTMLAttributes<HTMLHeadingElement>, "color">,
    TitleVariantsProps {
  /** Semantic heading level (1-6) determining HTML tag */
  level?: TitleLevel;
  /** Semantic HTML tag override */
  as?: React.ElementType;
  children: React.ReactNode;
}

export const Title = forwardRef<HTMLHeadingElement, TitleProps>(
  (
    {
      level = 1,
      size,
      weight,
      color,
      align,
      as,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Component = as || (`h${level}` as React.ElementType);
    const resolvedSize = size || defaultSizeByLevel[level];

    return (
      <Component
        ref={ref}
        className={cn(
          titleVariants({ size: resolvedSize, weight, color, align }),
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Title.displayName = "Title";

// ==========================================
// 2. SUBTITLE COMPONENT WITH CVA
// ==========================================

export const subtitleVariants = cva("leading-relaxed transition-colors", {
  variants: {
    size: {
      lg: "text-lg sm:text-xl leading-relaxed",
      md: "text-base sm:text-lg leading-relaxed",
      sm: "text-sm sm:text-base leading-normal",
    },
    color: {
      default: "text-slate-700 dark:text-slate-300 font-medium",
      muted: "text-slate-500 dark:text-slate-400 font-normal",
      primary: "text-indigo-600/90 dark:text-indigo-400/90 font-medium",
      subtle: "text-slate-400 dark:text-slate-500 font-normal",
    },
  },
  defaultVariants: {
    size: "md",
    color: "muted",
  },
});

export type SubtitleVariantsProps = VariantProps<typeof subtitleVariants>;

export interface SubtitleProps
  extends Omit<React.HTMLAttributes<HTMLParagraphElement>, "color">,
    SubtitleVariantsProps {
  as?: React.ElementType;
  children: React.ReactNode;
}

export const Subtitle = forwardRef<HTMLParagraphElement, SubtitleProps>(
  ({ size, color, as = "p", className, children, ...props }, ref) => {
    const Component = as;
    return (
      <Component
        ref={ref}
        className={cn(subtitleVariants({ size, color }), className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Subtitle.displayName = "Subtitle";

// ==========================================
// 3. PARAGRAPH COMPONENT WITH CVA
// ==========================================

export const paragraphVariants = cva("transition-colors", {
  variants: {
    size: {
      lg: "text-lg leading-relaxed",
      md: "text-base leading-relaxed",
      sm: "text-sm leading-normal",
      xs: "text-xs leading-normal",
    },
    variant: {
      default: "text-slate-800 dark:text-slate-200",
      lead: "text-xl font-normal text-slate-700 dark:text-slate-300 leading-relaxed",
      muted: "text-slate-500 dark:text-slate-400",
      secondary: "text-slate-600 dark:text-slate-300",
    },
  },
  defaultVariants: {
    size: "md",
    variant: "default",
  },
});

export type ParagraphVariantsProps = VariantProps<typeof paragraphVariants>;

export interface ParagraphProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    ParagraphVariantsProps {
  as?: React.ElementType;
  children: React.ReactNode;
}

export const Paragraph = forwardRef<HTMLParagraphElement, ParagraphProps>(
  ({ size, variant, as = "p", className, children, ...props }, ref) => {
    const Component = as;
    return (
      <Component
        ref={ref}
        className={cn(paragraphVariants({ size, variant }), className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Paragraph.displayName = "Paragraph";

// ==========================================
// 4. CAPTION COMPONENT WITH CVA
// ==========================================

export const captionVariants = cva("inline-block transition-colors", {
  variants: {
    size: {
      sm: "text-xs leading-tight",
      xs: "text-[11px] leading-tight",
    },
    variant: {
      default: "text-slate-600 dark:text-slate-400 font-medium",
      muted: "text-slate-400 dark:text-slate-500 font-normal",
      uppercase:
        "text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold",
      mono: "font-mono text-slate-500 dark:text-slate-400",
    },
  },
  defaultVariants: {
    size: "sm",
    variant: "default",
  },
});

export type CaptionVariantsProps = VariantProps<typeof captionVariants>;

export interface CaptionProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    CaptionVariantsProps {
  as?: React.ElementType;
  children: React.ReactNode;
}

export const Caption = forwardRef<HTMLSpanElement, CaptionProps>(
  ({ size, variant, as = "span", className, children, ...props }, ref) => {
    const Component = as;
    return (
      <Component
        ref={ref}
        className={cn(captionVariants({ size, variant }), className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Caption.displayName = "Caption";

// ==========================================
// 5. LABEL COMPONENT WITH CVA
// ==========================================

export const labelVariants = cva(
  "inline-flex items-center gap-1.5 text-slate-900 dark:text-slate-100 select-none transition-colors",
  {
    variants: {
      size: {
        sm: "text-xs font-medium",
        md: "text-sm font-semibold",
        lg: "text-base font-semibold",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export type LabelVariantsProps = VariantProps<typeof labelVariants>;

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>,
    LabelVariantsProps {
  required?: boolean;
  optional?: boolean;
  as?: React.ElementType;
  children: React.ReactNode;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  (
    {
      size,
      required = false,
      optional = false,
      as = "label",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Component = as;
    return (
      <Component
        ref={ref}
        className={cn(labelVariants({ size }), className)}
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
          <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
            (optional)
          </span>
        )}
      </Component>
    );
  }
);

Label.displayName = "Label";

// Group export
export const Typography = {
  Title,
  Subtitle,
  Paragraph,
  Caption,
  Label,
};

export default Typography;
