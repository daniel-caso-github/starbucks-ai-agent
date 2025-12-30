/**
 * Either monad for explicit error handling.
 *
 * Either<L, R> represents a value that can be one of two types:
 * - Left<L>: Represents a failure/error case
 * - Right<R>: Represents a success case
 *
 * This pattern makes error handling explicit in the type system,
 * forcing callers to handle both success and failure cases.
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Either<string, number> {
 *   if (b === 0) {
 *     return left('Cannot divide by zero');
 *   }
 *   return right(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (result.isRight()) {
 *   console.log('Result:', result.value); // 5
 * } else {
 *   console.log('Error:', result.value); // Never reached
 * }
 * ```
 */

// Left represents failure
export class Left<L> {
  constructor(public readonly value: L) {}

  isLeft(): this is Left<L> {
    return true;
  }

  isRight(): this is Right<never> {
    return false;
  }

  // Transform the success value (no-op for Left)
  map<R2>(_fn: (r: never) => R2): Either<L, R2> {
    return this as unknown as Either<L, R2>;
  }

  // Transform the error value
  mapLeft<L2>(fn: (l: L) => L2): Either<L2, never> {
    return new Left(fn(this.value));
  }

  // Chain another Either-returning operation (no-op for Left)
  flatMap<R2>(_fn: (r: never) => Either<L, R2>): Either<L, R2> {
    return this as unknown as Either<L, R2>;
  }

  // Get value or default
  getOrElse<R>(defaultValue: R): R {
    return defaultValue;
  }

  // Get value or compute from error
  getOrElseGet<R>(fn: (l: L) => R): R {
    return fn(this.value);
  }

  // Fold: apply one of two functions depending on the case
  fold<T>(onLeft: (l: L) => T, _onRight: (r: never) => T): T {
    return onLeft(this.value);
  }
}

// Right represents success
export class Right<R> {
  constructor(public readonly value: R) {}

  isLeft(): this is Left<never> {
    return false;
  }

  isRight(): this is Right<R> {
    return true;
  }

  // Transform the success value
  map<R2>(fn: (r: R) => R2): Either<never, R2> {
    return new Right(fn(this.value));
  }

  // Transform the error value (no-op for Right)
  mapLeft<L2>(_fn: (l: never) => L2): Either<L2, R> {
    return this as unknown as Either<L2, R>;
  }

  // Chain another Either-returning operation
  flatMap<L, R2>(fn: (r: R) => Either<L, R2>): Either<L, R2> {
    return fn(this.value);
  }

  // Get value or default (returns actual value for Right)
  getOrElse(_defaultValue: R): R {
    return this.value;
  }

  // Get value or compute from error (returns actual value for Right)
  getOrElseGet(_fn: (l: never) => R): R {
    return this.value;
  }

  // Fold: apply one of two functions depending on the case
  fold<T>(_onLeft: (l: never) => T, onRight: (r: R) => T): T {
    return onRight(this.value);
  }
}

// Union type
export type Either<L, R> = Left<L> | Right<R>;

// Factory functions for cleaner syntax
export const left = <L, R = never>(value: L): Either<L, R> => new Left(value);
export const right = <L = never, R = unknown>(value: R): Either<L, R> => new Right(value);

// Helper to convert try/catch to Either
export const tryCatch = <L, R>(fn: () => R, onError: (error: unknown) => L): Either<L, R> => {
  try {
    return right(fn());
  } catch (error) {
    return left(onError(error));
  }
};

// Async version of tryCatch
export const tryCatchAsync = async <L, R>(
  fn: () => Promise<R>,
  onError: (error: unknown) => L,
): Promise<Either<L, R>> => {
  try {
    const result = await fn();
    return right(result);
  } catch (error) {
    return left(onError(error));
  }
};
