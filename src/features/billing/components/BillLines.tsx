"use client";

import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { useId } from "react";
import { useWatch, type UseFieldArrayReturn, type UseFormReturn } from "react-hook-form";

import { Button, IconButton } from "@/components/ui/button";
import { MoneyField } from "@/components/ui/money-field";
import { Panel } from "@/components/ui/panel";
import { TextField } from "@/components/ui/text-field";
import { BILL_MAX_ITEMS, MAX_QUANTITY, TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { formatPaise } from "@/lib/format/currency";

import { linePaise, type BillForm, type BillFormLine } from "../form";

const { billing: words } = UI_TEXT;

/** A line's name, as it reads on the bill. */
const titleOf = (line: BillFormLine) =>
  line.kind === "TYPED" ? line.description.trim() || words.descriptionLabel : line.name;

/**
 * The bill's lines (plan §15.2; D303, D308, D309): each its name — and the
 * treatment it is for — how many, at what price and what it comes to, with
 * **Remove**. The price is a field for whoever may change prices, its
 * read-out for anyone else (D309); a typed line is theirs alone (D284). A
 * treatment with no entry of its name asks for one (D308). **Add line**
 * opens the price list.
 */
export function BillLines({
  form,
  lines,
  canChangePrices,
  onAdd,
  onPick,
}: {
  form: UseFormReturn<BillForm>;
  lines: UseFieldArrayReturn<BillForm, "lines">;
  canChangePrices: boolean;
  onAdd: () => void;
  /** Pick an entry for a treatment's reminder, at its index. */
  onPick: (index: number) => void;
}) {
  const {
    formState: { errors },
  } = form;
  const count = lines.fields.length;
  const wrong = errors.lines?.root?.message ?? errors.lines?.message;
  return (
    <Panel title={words.linesTitle}>
      {count === 0 && <p className="text-small text-muted">{words.noLines}</p>}
      {lines.fields.map((field, index) => (
        <Line
          key={field.id}
          form={form}
          index={index}
          canChangePrices={canChangePrices}
          onRemove={() => lines.remove(index)}
          onPick={() => onPick(index)}
        />
      ))}
      {wrong && (
        <p role="alert" className="text-small font-bold text-coral">
          {wrong}
        </p>
      )}
      {count < BILL_MAX_ITEMS && (
        <div>
          <Button label={words.addLine} icon={Plus} variant="secondary" size="sm" onClick={onAdd} />
        </div>
      )}
    </Panel>
  );
}

function Line({
  form,
  index,
  canChangePrices,
  onRemove,
  onPick,
}: {
  form: UseFormReturn<BillForm>;
  index: number;
  canChangePrices: boolean;
  onRemove: () => void;
  onPick: () => void;
}) {
  const {
    control,
    register,
    formState: { errors },
  } = form;
  const headId = useId();
  const line = useWatch({ control, name: `lines.${index}` });
  const wrong = errors.lines?.[index] as
    | {
        name?: { message?: string };
        description?: { message?: string };
        quantity?: { message?: string };
        price?: { message?: string };
      }
    | undefined;
  const title = titleOf(line);

  if (line.kind === "PICK") {
    return (
      <div role="group" aria-labelledby={headId} className="grid gap-3 rounded-row bg-coral-soft p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <p id={headId} className="flex items-start gap-1.5 font-bold text-ink">
            <TriangleAlert size={18} strokeWidth={2.5} aria-hidden="true" className="mt-0.5 shrink-0 text-coral" />
            {words.pickReminder(line.name)}
          </p>
          <div className="-my-1.5 -mr-1.5">
            <IconButton icon={Trash2} label={words.removeLine(line.name)} onClick={onRemove} />
          </div>
        </div>
        {wrong?.name?.message && (
          <p role="alert" className="text-small font-bold text-coral">
            {wrong.name.message}
          </p>
        )}
        <div>
          <Button
            label={words.pickEntry}
            aria-label={words.pickEntryFor(line.name)}
            variant="secondary"
            size="sm"
            onClick={onPick}
          />
        </div>
      </div>
    );
  }

  const amount = (Number.isInteger(line.quantity) ? line.quantity : 0) * linePaise(line);
  return (
    <div role="group" aria-labelledby={headId} className="grid gap-3 rounded-row bg-ground p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p id={headId} className="font-bold break-words text-ink">
            {title}
          </p>
          {line.kind === "SERVICE" && line.treatmentName && (
            <p className="text-small text-muted">{words.forTreatment(line.treatmentName)}</p>
          )}
        </div>
        <div className="-my-1.5 -mr-1.5">
          <IconButton icon={Trash2} label={words.removeLine(title)} onClick={onRemove} />
        </div>
      </div>
      {line.kind === "TYPED" && (
        <TextField
          label={words.descriptionLabel}
          required
          autoComplete="off"
          maxLength={TEXT_LIMITS.serviceName}
          error={wrong?.description?.message}
          {...register(`lines.${index}.description`)}
        />
      )}
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[6rem_minmax(0,10rem)_minmax(0,1fr)]">
        <TextField
          label={words.quantityLabel}
          aria-label={words.quantityOf(title)}
          inputMode="numeric"
          autoComplete="off"
          maxLength={String(MAX_QUANTITY).length}
          error={wrong?.quantity?.message}
          {...register(`lines.${index}.quantity`, { valueAsNumber: true })}
        />
        {canChangePrices || line.kind === "TYPED" ? (
          <MoneyField
            label={words.priceLabel}
            aria-label={words.priceOf(title)}
            error={wrong?.price?.message}
            {...register(`lines.${index}.price`)}
          />
        ) : (
          <div>
            <p className="mb-1.5 text-small font-bold text-ink">{words.priceLabel}</p>
            <p className="py-3 text-ink tabular-nums">{formatPaise(linePaise(line))}</p>
          </div>
        )}
        <div className="col-span-2 flex items-baseline justify-between gap-2 sm:col-span-1 sm:block sm:text-right">
          <p className="text-small font-bold text-ink sm:mb-1.5">{words.amountLabel}</p>
          <p className="font-bold text-ink tabular-nums sm:py-3">{formatPaise(amount)}</p>
        </div>
      </div>
    </div>
  );
}
