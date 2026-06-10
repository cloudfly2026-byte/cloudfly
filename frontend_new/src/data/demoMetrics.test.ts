// CLOUD-341 - Unit tests for demoMetrics.ts
// Validates that all exports exist and data is correctly structured

import { describe, it, expect } from 'vitest';
import {
  demoVisitsByYear,
  demoOrigins,
  demoTopPages,
  demoBounceRate,
} from '../data/demoMetrics';

describe('demoMetrics', () => {
  describe('demoVisitsByYear', () => {
    it('should be an array with 5 entries', () => {
      expect(demoVisitsByYear).toHaveLength(5);
    });

    it('should have year and visits properties', () => {
      demoVisitsByYear.forEach((entry) => {
        expect(entry).toHaveProperty('year');
        expect(entry).toHaveProperty('visits');
        expect(typeof entry.year).toBe('string');
        expect(typeof entry.visits).toBe('number');
      });
    });

    it('should be ordered chronologically', () => {
      const years = demoVisitsByYear.map((e) => parseInt(e.year, 10));
      for (let i = 1; i < years.length; i++) {
        expect(years[i]).toBeGreaterThan(years[i - 1]);
      }
    });

    it('should have increasing visits', () => {
      for (let i = 1; i < demoVisitsByYear.length; i++) {
        expect(demoVisitsByYear[i].visits).toBeGreaterThan(
          demoVisitsByYear[i - 1].visits
        );
      }
    });
  });

  describe('demoOrigins', () => {
    it('should be an array with 5 entries', () => {
      expect(demoOrigins).toHaveLength(5);
    });

    it('should have name and value properties', () => {
      demoOrigins.forEach((entry) => {
        expect(entry).toHaveProperty('name');
        expect(entry).toHaveProperty('value');
        expect(typeof entry.name).toBe('string');
        expect(typeof entry.value).toBe('number');
      });
    });

    it('should sum to 100', () => {
      const total = demoOrigins.reduce((sum, o) => sum + o.value, 0);
      expect(total).toBe(100);
    });

    it('should include Google as top origin', () => {
      const google = demoOrigins.find((o) => o.name === 'Google');
      expect(google).toBeDefined();
      expect(google!.value).toBe(45);
    });
  });

  describe('demoTopPages', () => {
    it('should be an array with 5 entries', () => {
      expect(demoTopPages).toHaveLength(5);
    });

    it('should have page and views properties', () => {
      demoTopPages.forEach((entry) => {
        expect(entry).toHaveProperty('page');
        expect(entry).toHaveProperty('views');
        expect(typeof entry.page).toBe('string');
        expect(typeof entry.views).toBe('number');
      });
    });

    it('should be sorted by views descending', () => {
      for (let i = 1; i < demoTopPages.length; i++) {
        expect(demoTopPages[i].views).toBeLessThanOrEqual(
          demoTopPages[i - 1].views
        );
      }
    });

    it('should include /inicio as top page', () => {
      expect(demoTopPages[0].page).toBe('/inicio');
    });
  });

  describe('demoBounceRate', () => {
    it('should be a number', () => {
      expect(typeof demoBounceRate).toBe('number');
    });

    it('should be between 0 and 100', () => {
      expect(demoBounceRate).toBeGreaterThanOrEqual(0);
      expect(demoBounceRate).toBeLessThanOrEqual(100);
    });

    it('should be 32.5', () => {
      expect(demoBounceRate).toBe(32.5);
    });
  });
});
