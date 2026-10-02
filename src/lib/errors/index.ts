export { AppError, KIND_STATUS, type AppErrorShape, type ErrorKind } from "./AppError";
export { errorMessage } from "./errorMessage";
export { fromPostgrestError, kindOf } from "./fromSupabaseError";
export {
  authenticationError,
  authorizationError,
  businessRuleError,
  conflictError,
  externalServiceError,
  internalError,
  isAppError,
  notFoundError,
  signInRequired,
  toAppError,
  validationError,
} from "./kinds";
