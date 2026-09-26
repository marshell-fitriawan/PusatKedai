import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Card brutalist (docs/design_1.md): siku (radius 0), border 2px ink, satu
 * shadow hard `4px 4px 0 0 ink` tanpa blur. Tidak ada varian yang memakai
 * shadow lembut atau border tipis.
 */
export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-2 border-ink bg-surface p-4 shadow-brutal",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3 flex flex-col gap-1", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-lg font-bold tracking-tight", className)} {...props} />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-text-secondary", className)} {...props} />
  );
}
