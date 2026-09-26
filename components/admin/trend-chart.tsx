import { cn } from "@/lib/utils";

export type BarDatum = {
  label: string;
  value: number;
  hint?: string;
};

export type BarSeries = {
  name: string;
  color: string;
  points: BarDatum[];
};

/** Warna seri untuk perbandingan multi-kedai. */
export const warnaSeri = [
  "bg-primary",
  "bg-info",
  "bg-success",
  "bg-warning",
  "bg-danger",
];

/**
 * Tren satu rangkaian sebagai bar chart CSS murni -- tanpa library chart.
 *
 * Tinggi plot ditetapkan (h-40 md:h-56) supaya `height: %` bar punya basis
 * tinggi yang pasti. Nilai presisi ada di tooltip native (`title`). Bar dan
 * label pakai token desain, angka menjauh dari hex raw.
 */
export function TrendChart({
  data,
  className,
}: {
  data: BarDatum[];
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className={cn("pt-2", className)}>
      <div className="flex h-40 items-end gap-0.5 md:h-56" role="img">
        {data.map((d) => (
          <div
            key={d.label}
            title={d.hint ?? `${d.label}: ${d.value.toLocaleString("id-ID")}`}
            className="group flex min-w-0 flex-1 flex-col"
          >
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full border-2 border-ink bg-primary transition-colors group-hover:bg-primary-dark"
                style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5">
        {data.map((d) => (
          <span
            key={d.label}
            className="min-w-0 flex-1 truncate text-center text-[10px] leading-none text-text-secondary"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Perbandingan beberapa kedai: satu kelompok bar per bucket.
 * Dipakai di /admin/dashboard/perbandingan.
 */
export function GroupedBars({
  labels,
  series,
  className,
}: {
  labels: string[];
  series: BarSeries[];
  className?: string;
}) {
  const max = Math.max(
    1,
    ...series.flatMap((s) => s.points.map((p) => p.value)),
  );

  return (
    <div className={cn("pt-2", className)}>
      <div className="flex h-40 items-end gap-0.5 md:h-56" role="img">
        {labels.map((label, i) => (
          <div key={label} className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-full items-end justify-center gap-0.5 md:gap-1">
              {series.map((s) => {
                const { value, hint } = s.points[i];
                return (
                  <div
                    key={s.name}
                    title={hint}
                    className="group flex h-full min-w-0 flex-1 flex-col justify-end"
                  >
                    <div
                      className={cn(
                        "w-full border-2 border-ink transition-colors",
                        s.color,
                      )}
                      style={{ height: `${Math.max(2, (value / max) * 100)}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5">
        {labels.map((label) => (
          <span
            key={label}
            className="min-w-0 flex-1 truncate text-center text-[10px] leading-none text-text-secondary"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}