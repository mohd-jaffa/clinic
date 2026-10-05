import { useId, type ReactNode } from "react";

/**
 * One step of a patient import (D131): its title and what it asks, what it
 * holds, and its way on — Back and Next, side by side under it.
 */
export function ImportStep({
  title,
  hint,
  children,
  actions,
}: {
  title: string;
  hint?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid max-w-2xl grid-cols-1 gap-5">
      <div>
        <h2 id={id} className="text-title font-bold text-ink">
          {title}
        </h2>
        {hint && <p className="mt-1.5 text-muted">{hint}</p>}
      </div>
      {children}
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </section>
  );
}
