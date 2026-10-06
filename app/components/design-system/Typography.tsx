import React, { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

export type HeadingProps = {
  asChild?: boolean;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export const Heading = forwardRef<HTMLDivElement, HeadingProps>(
  ({ asChild = false, className, children, ...props }, ref) => {
    const Component = asChild ? Slot : "div";

    return (
      <Component
        ref={ref}
        className={cn(
          "text-6xl font-bold tracking-tight text-font dark:text-surface transition-colors",
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Heading.displayName = "Heading";

export type TitleProps = {
  asChild?: boolean;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export const Title = forwardRef<HTMLDivElement, TitleProps>(
  ({ asChild = false, className, children, ...props }, ref) => {
    const Component = asChild ? Slot : "div";

    return (
      <Component
        ref={ref}
        className={cn(
          "text-lg font-bold tracking-tight text-font dark:text-surface transition-colors",
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Title.displayName = "Title";

export type SubtitleProps = {
  asChild?: boolean;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export const Subtitle = forwardRef<HTMLDivElement, SubtitleProps>(
  ({ asChild = false, className, children, ...props }, ref) => {
    const Component = asChild ? Slot : "div";
    return (
      <Component
        ref={ref}
        className={cn(
          "text-base font-medium text-font dark:text-surface transition-colors",
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Subtitle.displayName = "Subtitle";

export type ParagraphProps = {
  asChild?: boolean;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLParagraphElement>;

export const Paragraph = forwardRef<HTMLParagraphElement, ParagraphProps>(
  ({ asChild = false, className, children, ...props }, ref) => {
    const Component = asChild ? Slot : "p";
    return (
      <Component
        ref={ref}
        className={cn(
          "text-base font-normal text-font dark:text-surface transition-colors",
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Paragraph.displayName = "Paragraph";

export type LabelProps = {
  asChild?: boolean;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export const Label = forwardRef<HTMLDivElement, LabelProps>(
  ({ asChild = false, className, children, ...props }, ref) => {
    const Component = asChild ? Slot : "div";
    return (
      <Component
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 text-sm font-medium text-font-light dark:text-font-light select-none transition-colors",
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Label.displayName = "Label";

export type CaptionProps = {
  asChild?: boolean;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export const Caption = forwardRef<HTMLDivElement, CaptionProps>(
  ({ asChild = false, className, children, ...props }, ref) => {
    const Component = asChild ? Slot : "div";
    return (
      <Component
        ref={ref}
        className={cn(
          "inline-block text-xs font-normal text-font-light dark:text-font-light transition-colors",
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Caption.displayName = "Caption";

export const Typography = {
  Heading,
  Title,
  Subtitle,
  Paragraph,
  Label,
  Caption,
};

export default Typography;
