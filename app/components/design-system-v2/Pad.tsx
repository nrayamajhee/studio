import { Key, type KeyProps } from "./Key";
import { cn } from "../../lib/utils";
import styles from "./Pad.module.css";

export type PadProps = Omit<KeyProps, "variant"> & {
  variant?: "white" | "black";
};

export function Pad({ variant = "white", className, ...props }: PadProps) {
  return (
    <Key {...props} variant={variant} className={cn(styles.pad, className)} />
  );
}
