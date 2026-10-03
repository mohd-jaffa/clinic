/**
 * How a form resets after a save (react-hook-form's `resetOptions`): to what
 * was saved, keeping the fields it already knows. Without it a reset forgets
 * its registered fields, and — the React Compiler memoizing each
 * `register()`, so none is registered again — a text field typed into
 * afterwards is never read: the next save finds it empty. Every form that
 * resets passes this.
 */
export const FORM_RESET_OPTIONS = { keepFieldsRef: true } as const;
