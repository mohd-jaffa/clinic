"use client";

import { useEffect, useRef, useState } from "react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { ApiError } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import { useRevalidate } from "@/lib/query/useRevalidate";

import { ImportClient } from "../api.client";
import type { CheckedRow } from "../import-rows";

const { patientImport } = UI_TEXT;

/** Where sending an import stands. */
export type ImportSendState =
  | { status: "IDLE" }
  | { status: "SENDING"; done: number; total: number }
  | { status: "STOPPED"; done: number; total: number }
  | { status: "DONE"; imported: number; refused: { row: CheckedRow; problem: string }[] };

/**
 * A refusal of the rows themselves — a value the database would not take —
 * leaves that batch out and goes on; anything else (no connection, the plan
 * ended, the session gone) stops, to carry on from the same batch.
 */
const refusesRows = (failure: unknown) =>
  failure instanceof ApiError && (failure.code === "VALIDATION_ERROR" || failure.code === "PATIENT_BIRTH_DATE_INVALID");

/**
 * Sending an import's ready rows (plan §10.5, D133), a batch at a time, one
 * after another. Each row goes under its own key, so a batch sent again
 * after a stop adds no one twice: **Try again** carries on from the batch
 * that stopped. While it sends, leaving the page asks first. Once it is
 * done, the patients lists are read again.
 */
export function useImportSend(batchSize: number) {
  const respond = useResponse();
  const refresh = useRevalidate();
  const [state, setState] = useState<ImportSendState>({ status: "IDLE" });
  const progress = useRef({
    rows: [] as readonly CheckedRow[],
    next: 0,
    imported: 0,
    refused: [] as { row: CheckedRow; problem: string }[],
  });

  useEffect(() => {
    if (state.status !== "SENDING") return;
    const stay = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", stay);
    return () => window.removeEventListener("beforeunload", stay);
  }, [state.status]);

  const carryOn = async () => {
    const { rows } = progress.current;
    for (let start = progress.current.next; start < rows.length; start += batchSize) {
      setState({ status: "SENDING", done: start, total: rows.length });
      const batch = rows.slice(start, start + batchSize);
      try {
        progress.current.imported += (await ImportClient.send(batch.map((row) => row.input!))).imported;
      } catch (failure) {
        if (!refusesRows(failure)) {
          progress.current.next = start;
          setState({ status: "STOPPED", done: start, total: rows.length });
          respond.failure(failure, { title: patientImport.stopped(start, rows.length), retry: () => void carryOn() });
          return;
        }
        progress.current.refused.push(...batch.map((row) => ({ row, problem: (failure as ApiError).message })));
      }
      progress.current.next = start + batchSize;
    }
    await refresh([apiRoutes.patients.search, apiRoutes.patients.matches]);
    setState({ status: "DONE", imported: progress.current.imported, refused: progress.current.refused });
  };

  /** Starts sending these rows — the ready ones, and the duplicates chosen. */
  const send = (rows: readonly CheckedRow[]) => {
    progress.current = { rows, next: 0, imported: 0, refused: [] };
    return carryOn();
  };

  /** Back to the start, for another file. */
  const reset = () => {
    progress.current = { rows: [], next: 0, imported: 0, refused: [] };
    setState({ status: "IDLE" });
  };

  return { state, send, retry: carryOn, reset };
}
