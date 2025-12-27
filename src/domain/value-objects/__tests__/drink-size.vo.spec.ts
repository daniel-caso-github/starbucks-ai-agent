import { DrinkSize } from '../drink-size.vo';
import { InvalidValueException } from '../../exceptions';

describe('DrinkSize', () => {
  describe('factory methods', () => {
    it('should create tall size', () => {
      const size = DrinkSize.tall();

      expect(size.value).toBe('tall');
      expect(size.capacityOz).toBe(12);
    });

    it('should create grande size', () => {
      const size = DrinkSize.grande();

      expect(size.value).toBe('grande');
      expect(size.capacityOz).toBe(16);
    });

    it('should create venti size', () => {
      const size = DrinkSize.venti();

      expect(size.value).toBe('venti');
      expect(size.capacityOz).toBe(20);
    });
  });

  describe('fromString', () => {
    it('should create size from valid string', () => {
      const size = DrinkSize.fromString('grande');

      expect(size.value).toBe('grande');
      expect(size.capacityOz).toBe(16);
    });

    it('should handle case insensitivity', () => {
      const size = DrinkSize.fromString('GRANDE');

      expect(size.value).toBe('grande');
    });

    it('should trim whitespace', () => {
      const size = DrinkSize.fromString('  venti  ');

      expect(size.value).toBe('venti');
    });

    it('should throw error for invalid size', () => {
      expect(() => DrinkSize.fromString('small')).toThrow(InvalidValueException);
    });

    it('should throw error for empty string', () => {
      expect(() => DrinkSize.fromString('')).toThrow(InvalidValueException);
    });
  });

  describe('comparison', () => {
    it('should correctly compare sizes with isLargerThan', () => {
      const tall = DrinkSize.tall();
      const grande = DrinkSize.grande();
      const venti = DrinkSize.venti();

      expect(venti.isLargerThan(grande)).toBe(true);
      expect(grande.isLargerThan(tall)).toBe(true);
      expect(tall.isLargerThan(venti)).toBe(false);
    });

    it('should return true for equal sizes', () => {
      const a = DrinkSize.grande();
      const b = DrinkSize.grande();

      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different sizes', () => {
      const a = DrinkSize.tall();
      const b = DrinkSize.venti();

      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the size value', () => {
      const size = DrinkSize.grande();

      expect(size.toString()).toBe('grande');
    });
  });
});
