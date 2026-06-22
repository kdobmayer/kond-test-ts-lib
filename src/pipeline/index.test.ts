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

  describe('ValidationReport integration', () => {
    it('accumulates issues from multiple validateWith steps', () => {
      const schema1: Schema = { name: { type: 'string', required: true } };
      const schema2: Schema = { age: { type: 'number', min: 0 } };

      const result = createPipeline(data)
        .validateWith(schema1)
        .validateWith(schema2)
        .execute();

      expect(result.validationResults).toHaveLength(2);
      expect(result.validationReport.getSummary().totalResults).toBe(2);
    });

    it('accumulates issues from validateWith and validateRules', () => {
      const schema: Schema = { name: { type: 'string', required: true } };
      const result = createPipeline(data)
        .validateWith(schema)
        .validateRules([{
          name: 'age-check',
          field: 'age',
          message: 'Too young',
          validate: (v) => (v as number) >= 28,
        }])
        .execute();

      expect(result.validationResults).toHaveLength(2);
      expect(result.validationReport.getSummary().totalResults).toBe(2);
    });

    it('includes issues from both steps in the report', () => {
      const badData: DataSet = [
        { name: null, age: -5 },
      ];
      const schema1: Schema = { name: { type: 'string', required: true } };
      const schema2: Schema = { age: { type: 'number', min: 0 } };

      const result = createPipeline(badData)
        .validateWith(schema1)
        .validateWith(schema2)
        .execute();

      const summary = result.validationReport.getSummary();
      expect(summary.totalResults).toBe(2);
      expect(summary.errorCount).toBeGreaterThan(0);
    });

    it('getValidationReport() returns a snapshot with the same content as result.validationReport', () => {
      const schema: Schema = { name: { type: 'string', required: true } };
      const pipeline = createPipeline(data).validateWith(schema);
      const result = pipeline.execute();

      expect(pipeline.getValidationReport().getSummary()).toEqual(result.validationReport.getSummary());
    });

    it('mutating a returned report does not affect the pipeline internal state', () => {
      const badData: DataSet = [{ name: null }];
      const schema: Schema = { name: { type: 'string', required: true } };
      const pipeline = createPipeline(badData).validateWith(schema);
      const result = pipeline.execute();

      result.validationReport.addIssue({ field: 'injected', message: 'injected', severity: 'error' });

      expect(pipeline.getValidationReport().getSummary().totalIssues).toBe(
        result.validationReport.getSummary().totalIssues - 1,
      );
    });

    it('resets the report on each execute() call', () => {
      const schema: Schema = { name: { type: 'string', required: true } };
      const pipeline = createPipeline(data).validateWith(schema);

      pipeline.execute();
      const result = pipeline.execute();

      expect(result.validationReport.getSummary().totalResults).toBe(1);
    });

    it('reset() clears the validation report', () => {
      const schema: Schema = { name: { type: 'string', required: true } };
      const pipeline = createPipeline(data).validateWith(schema);
      pipeline.execute();
      pipeline.reset();

      expect(pipeline.getValidationReport().getSummary().totalResults).toBe(0);
    });

    it('result.validationResults preserves backward compatibility', () => {
      const schema: Schema = { name: { type: 'string', required: true } };
      const result = createPipeline(data).validateWith(schema).execute();

      expect(result.validationResults).toHaveLength(1);
      expect(result.validationResults[0]).toHaveProperty('valid');
      expect(result.validationResults[0]).toHaveProperty('issues');
    });
  });

  describe('errorThreshold option', () => {
    it('aborts when error count exceeds threshold', () => {
      const badData: DataSet = [
        { name: null, age: 30 },
        { name: null, age: 25 },
      ];
      const schema: Schema = { name: { type: 'string', required: true } };

      const transformExecuted: boolean[] = [];
      const result = createPipeline(badData)
        .validateWith(schema)
        .transform((d) => { transformExecuted.push(true); return d; })
        .execute({ errorThreshold: 0 });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/threshold exceeded/i);
      expect(transformExecuted).toHaveLength(0);
    });

    it('completes normally when errors do not exceed threshold', () => {
      const badData: DataSet = [
        { name: null, age: 30 },
        { name: null, age: 25 },
        { name: null, age: 35 },
      ];
      const schema: Schema = { name: { type: 'string', required: true } };

      const result = createPipeline(badData)
        .validateWith(schema)
        .execute({ errorThreshold: 5 });

      expect(result.errors).toHaveLength(0);
    });

    it('records validation results up to the point of abort', () => {
      const badData: DataSet = [{ name: null }];
      const schema1: Schema = { name: { type: 'string', required: true } };
      const schema2: Schema = { age: { type: 'number', required: true } };

      const result = createPipeline(badData)
        .validateWith(schema1)
        .validateWith(schema2)
        .execute({ errorThreshold: 0 });

      expect(result.validationResults).toHaveLength(1);
      expect(result.validationReport.getSummary().totalResults).toBe(1);
    });

    it('includes threshold message in errors array', () => {
      const badData: DataSet = [{ name: null }];
      const schema: Schema = { name: { type: 'string', required: true } };

      const result = createPipeline(badData)
        .validateWith(schema)
        .execute({ errorThreshold: 0 });

      expect(result.errors[0]).toContain('1 errors');
    });
  });
});
