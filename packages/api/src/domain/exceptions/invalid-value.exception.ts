import { DomainException } from './domain.exception';

/**
 * Thrown when a value object receives an invalid value.
 * Examples: negative money, empty OrderId, invalid drink size.
 */
export class InvalidValueException extends DomainException {
  constructor(valueObjectName: string, reason: string) {
    super(`Invalid ${valueObjectName}: ${reason}`, 'INVALID_VALUE');
  }
}
