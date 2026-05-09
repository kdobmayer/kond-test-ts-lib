import { validateSchema, coerceValue, coerceDataset, validateCustomRules, combineResults } from './index';
import { Schema } from '../types';

describe('coerceValue', () => {
  it('coerces string to number', () => {
    expect(coerceValue('42', 'number')).toBe(42);
    expect(coerceValue('abc', 'number')).toBeNull();
  });

  it('coerces to boolean', () => {
    expect(coerceValue('true', 'boolean')).toBe(true);
    expect(coerceValue('false', 'boolean')).toBe(false);
    expect(coerceValue('maybe', 'boolean')).toBeNull();
  });

  it('validates email format', () => {
    expect(coerceValue('test@example.com', 'email')).toBe('test@example.com');
    expect(coerceValue('not-email', 'email')).toBeNull();
  });

  it('handles null/undefined', () => {
    expect(coerceValue(null, 'string')).toBeNull();
    expect(coerceValue(undefined, 'number')).toBeNull();
  });
});

describe('validateSchema', () => {
  const schema: Schema = {
    name: { type: 'string', required: true, min: 2, max: 50 },
    age: { type: 'number', required: true, min: 0, max: 150 },
    email: { type: 'email', required: false },
  };

  it('validates valid data', () => {
    const data = [{ name: 'Alice', age: 30, email: 'alice@test.com' }];
    const result = validateSchema(data, schema);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('catches missing required fields', () => {
    const data = [{ name: null, age: 30 }];
    const result = validateSchema(data, schema);
    expect(result.valid).toBe(false);
    expect(result.issues[0].field).toBe('name');
  });

  it('catches out-of-range numbers', () => {
    const data = [{ name: 'Alice', age: 200 }];
    const result = validateSchema(data, schema);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.field === 'age')).toBe(true);
  });

  it('catches string length violations', () => {
    const data = [{ name: 'A', age: 30 }];
    const result = validateSchema(data, schema);
    expect(result.valid).toBe(false);
  });

  it('validates pattern', () => {
    const schema: Schema = { code: { type: 'string', pattern: '^[A-Z]{3}$' } };
    const data = [{ code: 'ABC' }, { code: 'ab' }];
    const result = validateSchema(data, schema);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
  });

  it('validates enum values', () => {
    const schema: Schema = { status: { type: 'string', enum: ['active', 'inactive'] } };
    const data = [{ status: 'active' }, { status: 'deleted' }];
    const result = validateSchema(data, schema);
    expect(result.valid).toBe(false);
  });

  it('validates custom function', () => {
    const schema: Schema = {
      value: { type: 'number', custom: (v) => typeof v === 'number' && v % 2 === 0 },
    };
    const data = [{ value: 4 }, { value: 3 }];
    const result = validateSchema(data, schema);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
  });
});

describe('coerceDataset', () => {
  it('coerces values according to schema', () => {
    const schema: Schema = { age: { type: 'number' }, active: { type: 'boolean' } };
    const data = [{ age: '30', active: 'true' }];
    const result = coerceDataset(data, schema);
    expect(result[0].age).toBe(30);
    expect(result[0].active).toBe(true);
  });
});

describe('validateCustomRules', () => {
  it('applies custom rules', () => {
    const data = [{ start: 1, end: 5 }, { start: 10, end: 3 }];
    const rules = [{
      name: 'end-after-start',
      message: 'End must be after start',
      validate: (_v: unknown, record: Record<string, unknown>) =>
        (record.end as number) > (record.start as number),
    }];
    const result = validateCustomRules(data, rules);
    expect(result.valid).toBe(false);
  });
});

describe('combineResults', () => {
  it('combines multiple results', () => {
    const r1 = { valid: true, issues: [] };
    const r2 = { valid: false, issues: [{ field: 'x', message: 'bad', severity: 'error' as const }] };
    const combined = combineResults(r1, r2);
    expect(combined.valid).toBe(false);
  });
});
