import { DomainException } from './domain.exception';

/**
 * Thrown when an order violates business rules.
 * Examples: invalid quantity, incompatible customizations, incomplete order.
 */
export class InvalidOrderException extends DomainException {
  constructor(message: string) {
    super(message, 'INVALID_ORDER');
  }
}
