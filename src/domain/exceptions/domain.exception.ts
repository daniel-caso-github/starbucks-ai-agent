/**
 * Base exception for all domain errors.
 * Extends Error to maintain stack trace and standard error behavior.
 */
export abstract class DomainException extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
