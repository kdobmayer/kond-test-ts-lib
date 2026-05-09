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
});
