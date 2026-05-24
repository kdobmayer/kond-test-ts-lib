import { createPipeline } from './index';
import { DataSet, Schema } from '../types';
import { ValidationReport } from '../validators';

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

  it('result.validationReport is a ValidationReport after validate step', () => {
    const schema: Schema = {
      name: { type: 'string', required: true },
      age: { type: 'number', min: 0 },
    };
    const result = createPipeline(data).validateWith(schema).execute();
    expect(result.validationReport).toBeInstanceOf(ValidationReport);
    const summary = result.validationReport.getSummary();
    expect(summary.totalIssues).toBe(result.validationResults[0].issues.length);
  });

  it('validationReport tracks clean rows using the current dataset size', () => {
    const invalidData: DataSet = [
      { name: null, age: -1, dept: 'eng' },
      { name: 'Bob', age: 25, dept: 'eng' },
    ];
    const schema: Schema = {
      name: { type: 'string', required: true },
      age: { type: 'number', min: 0 },
    };

    const result = createPipeline(invalidData).validateWith(schema).execute();
    const summary = result.validationReport.getSummary();

    expect(summary.failCount).toBe(1);
    expect(summary.passCount).toBe(1);
  });

  it('getValidationReport() matches result.validationReport', () => {
    const schema: Schema = { name: { type: 'string', required: true } };
    const pipeline = createPipeline(data).validateWith(schema);
    const result = pipeline.execute();
    expect(pipeline.getValidationReport()).toBe(result.validationReport);
  });

  it('result.validationReport is empty when no validate steps run', () => {
    const result = createPipeline(data).filter(r => r.age === 30).execute();
    expect(result.validationReport).toBeInstanceOf(ValidationReport);
    expect(result.validationReport.getSummary().totalIssues).toBe(0);
  });

  it('maxErrors causes early termination when error count exceeds threshold', () => {
    const invalidData: DataSet = [
      { name: null, age: -1, dept: 'eng' },
      { name: null, age: -1, dept: 'eng' },
    ];
    const schema: Schema = {
      name: { type: 'string', required: true },
      age: { type: 'number', min: 0 },
    };
    const afterValidate = jest.fn((d: DataSet) => d);
    const result = createPipeline(invalidData, { maxErrors: 1 })
      .validateWith(schema)
      .transform(afterValidate)
      .execute();

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/threshold exceeded/i);
    expect(afterValidate).not.toHaveBeenCalled();
  });

  it('maxErrors not set does not affect behavior', () => {
    const schema: Schema = {
      name: { type: 'string', required: true },
      age: { type: 'number', min: 0 },
    };
    const result = createPipeline(data).validateWith(schema).execute();
    expect(result.errors).toHaveLength(0);
    expect(result.stepsExecuted).toBe(1);
  });

  it('rejects invalid maxErrors values', () => {
    expect(() => createPipeline(data, { maxErrors: -1 })).toThrow(/maxErrors/i);
    expect(() => createPipeline(data, { maxErrors: 1.5 })).toThrow(/maxErrors/i);
  });
});
