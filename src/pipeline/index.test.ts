import { createPipeline } from './index';
import { DataSet, Schema } from '../types';

describe('Pipeline', () => {
  const data: DataSet = [
    { name: 'Alice', age: 30, dept: 'eng' },
    { name: 'Bob', age: 25, dept: 'eng' },
    { name: 'Charlie', age: 35, dept: 'sales' },
  ];

  it('chains transform and filter', () => {
    const result = createPipeline(data)
      .filter((r) => r.dept === 'eng')
      .transform((d) => d.map(r => ({ ...r, senior: (r.age as number) >= 30 })))
      .execute();

    expect(result.data).toHaveLength(2);
    expect(result.data[0].senior).toBe(true);
    expect(result.stepsExecuted).toBe(2);
  });

  it('validates with schema', () => {
    const schema: Schema = {
      name: { type: 'string', required: true },
      age: { type: 'number', min: 0 },
    };

    const result = createPipeline(data).validateWith(schema).execute();
    expect(result.validationResults).toHaveLength(1);
    expect(result.validationResults[0].valid).toBe(true);
  });

  it('validates with custom rules', () => {
    const result = createPipeline(data)
      .validateRules([{
        name: 'age-check',
        field: 'age',
        message: 'Too young',
        validate: (v) => (v as number) >= 28,
      }])
      .execute();

    expect(result.validationResults[0].valid).toBe(false);
  });

  it('handles errors in steps', () => {
    const result = createPipeline(data)
      .transform(() => { throw new Error('boom'); })
      .execute();

    expect(result.errors).toHaveLength(1);
    expect(result.stepsExecuted).toBe(0);
  });

  it('supports from() to set data', () => {
    const result = createPipeline().from(data).filter(r => r.age === 30).execute();
    expect(result.data).toHaveLength(1);
  });

  describe('onError modes', () => {
    it('collect mode (default) collects error and stops pipeline', () => {
      const result = createPipeline(data, { onError: 'collect' })
        .transform(() => { throw new Error('fail'); })
        .transform((d) => d.map(r => ({ ...r, tagged: true })))
        .execute();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('fail');
      expect(result.stepsExecuted).toBe(0);
      expect(result.data[0].tagged).toBeUndefined();
    });

    it('stop mode throws on first error', () => {
      expect(() =>
        createPipeline(data, { onError: 'stop' })
          .transform(() => { throw new Error('boom'); })
          .execute()
      ).toThrow('boom');
    });

    it('stop mode executes steps before the failing one', () => {
      const executed: string[] = [];
      expect(() =>
        createPipeline(data, { onError: 'stop' })
          .transform((d) => { executed.push('first'); return d; })
          .transform(() => { throw new Error('second fails'); })
          .execute()
      ).toThrow('second fails');
      expect(executed).toContain('first');
    });

    it('skip mode skips failing filter records and continues', () => {
      const testData: DataSet = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: null },
        { name: 'Charlie', age: 35 },
      ];
      const result = createPipeline(testData, { onError: 'skip' })
        .filter((r) => {
          if (r.age === null) throw new Error('null age');
          return (r.age as number) >= 30;
        })
        .execute();

      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('Alice');
      expect(result.data[1].name).toBe('Charlie');
      expect(result.stepsExecuted).toBe(1);
      expect(result.errors).toEqual(['Step 1, record 2: null age']);
    });

    it('skip mode skips failing transform step and continues', () => {
      const result = createPipeline(data, { onError: 'skip' })
        .transform(() => { throw new Error('bad transform'); })
        .transform((d) => d.map(r => ({ ...r, tagged: true })))
        .execute();

      expect(result.data[0].tagged).toBe(true);
      expect(result.stepsExecuted).toBe(2);
      expect(result.errors).toEqual(['Step 1: bad transform']);
    });

    it('skip mode skips failing validate step and continues', () => {
      const result = createPipeline(data, { onError: 'skip' })
        .transform((d) => { throw new Error('skip me'); return d; })
        .validateWith({ name: { type: 'string', required: true } })
        .execute();

      expect(result.validationResults).toHaveLength(1);
      expect(result.stepsExecuted).toBe(2);
      expect(result.errors).toEqual(['Step 1: skip me']);
    });

    it('skip mode restores prior data when a transform mutates then throws', () => {
      const result = createPipeline(data, { onError: 'skip' })
        .transform((d) => {
          d[0].name = 'Mutated';
          throw new Error('partial failure');
        })
        .execute();

      expect(result.data[0].name).toBe('Alice');
      expect(result.errors).toEqual(['Step 1: partial failure']);
    });
  });
});
