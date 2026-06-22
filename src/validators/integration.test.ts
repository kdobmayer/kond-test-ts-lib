import {
  ValidationReport,
  formatValidationReportJson,
  formatValidationReportMarkdown,
  formatValidationReportCsv,
  createPipeline,
} from '../index';
import { DataSet, Schema } from '../types';
import { CustomRule } from '../validators';

const mixedData: DataSet = [
  { name: 'Alice', age: 30, email: 'alice@example.com' },
  { name: 'Bob', age: -5, email: 'bob@example.com' },
  { name: null, age: 25, email: 'charlie@example.com' },
  { name: 'Diana', age: 40, email: 'not-an-email' },
];

const schema: Schema = {
  name: { type: 'string', required: true },
  age: { type: 'number', min: 0 },
  email: { type: 'email' },
};

const rules: CustomRule[] = [
  {
    name: 'age-reasonable',
    field: 'age',
    severity: 'error',
    message: 'Age must be <= 120',
    validate: (v) => v === null || v === undefined || (v as number) <= 120,
  },
  {
    name: 'name-not-short',
    field: 'name',
    severity: 'warning',
    message: 'Name should be at least 2 characters',
    validate: (v) => v === null || v === undefined || String(v).length >= 2,
  },
];

describe('end-to-end validation pipeline integration', () => {
  let report: ValidationReport;

  beforeAll(() => {
    const result = createPipeline(mixedData)
      .validateWith(schema)
      .validateRules(rules)
      .execute();
    report = result.validationReport;
  });

  it('accumulates results from both validation steps', () => {
    const summary = report.getSummary();
    expect(summary.totalResults).toBe(2);
    expect(summary.errorCount).toBeGreaterThan(0);
  });

  it('formatValidationReportJson round-trips correctly', () => {
    const json = formatValidationReportJson(report);
    const parsed = JSON.parse(json);
    expect(parsed.summary.errorCount).toBe(report.getSummary().errorCount);
    expect(Array.isArray(parsed.issues)).toBe(true);
  });

  it('formatValidationReportMarkdown contains table headers', () => {
    const md = formatValidationReportMarkdown(report);
    expect(md).toContain('| Severity | Count |');
    expect(md).toContain('| Field | Severity | Message | Row |');
    expect(md).toContain('| error |');
  });

  it('formatValidationReportCsv contains column header row', () => {
    const csv = formatValidationReportCsv(report);
    expect(csv).toContain('field,severity,message,row,value');
  });

  it('ValidationReport is importable from the package root', () => {
    const r = new ValidationReport();
    expect(r.getSummary().valid).toBe(true);
  });
});
