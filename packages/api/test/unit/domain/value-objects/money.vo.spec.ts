import { Money } from '@domain/value-objects';
import { InvalidValueException } from '@domain/exceptions';

describe('Money', () => {
  describe('creation', () => {
    it('should create money from cents', () => {
      const money = Money.fromCents(550);

      expect(money.cents).toBe(550);
      expect(money.dollars).toBe(5.5);
      expect(money.currency).toBe('USD');
    });

    it('should create money from dollars', () => {
      const money = Money.fromDollars(5.5);

      expect(money.cents).toBe(550);
      expect(money.dollars).toBe(5.5);
    });

    it('should create zero money', () => {
      const money = Money.zero();

      expect(money.cents).toBe(0);
      expect(money.dollars).toBe(0);
    });

    it('should round cents when creating from dollars', () => {
      const money = Money.fromDollars(5.555);

      expect(money.cents).toBe(556);
    });

    it('should throw error for negative amount', () => {
      expect(() => Money.fromCents(-100)).toThrow(InvalidValueException);
    });

    it('should throw error for invalid currency', () => {
      expect(() => Money.fromCents(100, 'INVALID')).toThrow(InvalidValueException);
    });
  });

  describe('arithmetic operations', () => {
    it('should add two money values', () => {
      const a = Money.fromDollars(5);
      const b = Money.fromDollars(3);

      const result = a.add(b);

      expect(result.dollars).toBe(8);
    });

    it('should subtract money values', () => {
      const a = Money.fromDollars(5);
      const b = Money.fromDollars(3);

      const result = a.subtract(b);

      expect(result.dollars).toBe(2);
    });

    it('should throw error when subtracting would result in negative', () => {
      const a = Money.fromDollars(3);
      const b = Money.fromDollars(5);

      expect(() => a.subtract(b)).toThrow(InvalidValueException);
    });

    it('should multiply by a factor', () => {
      const money = Money.fromDollars(5);

      const result = money.multiply(3);

      expect(result.dollars).toBe(15);
    });

    it('should throw error when adding different currencies', () => {
      const usd = Money.fromCents(100, 'USD');
      const eur = Money.fromCents(100, 'EUR');

      expect(() => usd.add(eur)).toThrow(InvalidValueException);
    });
  });

  describe('comparison', () => {
    it('should return true for equal money values', () => {
      const a = Money.fromDollars(5);
      const b = Money.fromDollars(5);

      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different amounts', () => {
      const a = Money.fromDollars(5);
      const b = Money.fromDollars(10);

      expect(a.equals(b)).toBe(false);
    });

    it('should correctly compare with isGreaterThan', () => {
      const a = Money.fromDollars(10);
      const b = Money.fromDollars(5);

      expect(a.isGreaterThan(b)).toBe(true);
      expect(b.isGreaterThan(a)).toBe(false);
    });
  });

  describe('formatting', () => {
    it('should format as currency string', () => {
      const money = Money.fromDollars(5.5);

      expect(money.format()).toBe('$5.50');
    });

    it('should format non-USD currency', () => {
      const money = Money.fromCents(550, 'EUR');

      expect(money.format()).toBe('EUR5.50');
    });
  });

  describe('immutability', () => {
    it('should not modify original when adding', () => {
      const original = Money.fromDollars(5);
      const other = Money.fromDollars(3);

      original.add(other);

      expect(original.dollars).toBe(5);
    });
  });
});
