import { formatTable, toChartData, toCsv, toJson, toMarkdown, summarize, formatValidationReportJson, formatValidationReportMarkdown, formatValidationReportCsv } from './index';
import { ValidationReport } from '../validators/report';
import { DataSet } from '../types';

const sampleData: DataSet = [
  { name: 'Alice', age: 30, dept: 'eng' },
  { name: 'Bob', age: 25, dept: 'sales' },
];

describe('formatTable', () => {
  it('formats data as ASCII table', () => {
    const result = formatTable(sampleData);
    expect(result).toContain('name');
    expect(result).toContain('Alice');
    expect(result).toContain('---');
  });

  it('returns (empty) for empty data', () => {
    expect(formatTable([])).toBe('(empty)');
  });

  it('respects alignment options', () => {
    const result = formatTable(sampleData, { alignment: { age: 'right' } });
    expect(result).toContain('30');
  });

  it('handles null values', () => {
    const data: DataSet = [{ name: 'Alice', value: null }];
    const result = formatTable(data);
    expect(result).toContain('Alice');
  });
});

describe('toChartData', () => {
  it('converts to chart data format', () => {
    const result = toChartData(sampleData, 'name', 'age');
    expect(result.points).toHaveLength(2);
    expect(result.points[0]).toEqual({ label: 'Alice', value: 30, group: undefined });
    expect(result.xAxis).toBe('name');
    expect(result.yAxis).toBe('age');
  });

  it('supports group field', () => {
    const result = toChartData(sampleData, 'name', 'age', 'dept');
    expect(result.points[0].group).toBe('eng');
  });

  it('defaults non-numeric values to 0', () => {
    const data: DataSet = [{ name: 'Alice', value: 'not a number' }];
    const result = toChartData(data, 'name', 'value');
    expect(result.points[0].value).toBe(0);
  });
});

describe('toCsv', () => {
  it('exports as CSV with headers', () => {
    const result = toCsv(sampleData);
    const lines = result.split('\n');
    expect(lines[0]).toBe('name,age,dept');
    expect(lines[1]).toBe('Alice,30,eng');
  });

  it('handles custom delimiter', () => {
    const result = toCsv(sampleData, { delimiter: ';' });
    expect(result).toContain('Alice;30;eng');
  });

  it('escapes fields with delimiters', () => {
    const data: DataSet = [{ name: 'Smith, John', age: 30 }];
    const result = toCsv(data);
    expect(result).toContain('"Smith, John"');
  });

  it('returns empty string for empty data', () => {
    expect(toCsv([])).toBe('');
  });

  it('skips headers when option is false', () => {
    const result = toCsv(sampleData, { headers: false });
    expect(result.split('\n')[0]).toBe('Alice,30,eng');
  });
});

describe('toJson', () => {
  it('exports as pretty JSON by default', () => {
    const result = toJson(sampleData);
    expect(JSON.parse(result)).toEqual(sampleData);
    expect(result).toContain('\n');
  });

  it('exports as NDJSON', () => {
    const result = toJson(sampleData, { arrayWrap: false });
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual(sampleData[0]);
  });
});

describe('toMarkdown', () => {
  it('formats as markdown table', () => {
    const result = toMarkdown(sampleData);
    expect(result).toContain('| name | age | dept |');
    expect(result).toContain('| --- | --- | --- |');
    expect(result).toContain('| Alice | 30 | eng |');
  });

  it('returns empty for empty data', () => {
    expect(toMarkdown([])).toBe('');
  });
});

function makeReport() {
  const report = new ValidationReport();
  report.addResult({
    valid: false,
    issues: [
      { field: 'age', message: 'must be positive', severity: 'error', row: 0, value: -1 },
      { field: 'name', message: 'required', severity: 'error', row: 1 },
      { field: 'age', message: 'suspicious value', severity: 'warning', row: 2, value: 999 },
      { field: 'email', message: 'unusual format', severity: 'info', row: 0 },
    ],
  });
  return report;
}

describe('formatValidationReportJson', () => {
  it('returns valid JSON with summary and issues keys', () => {
    const report = makeReport();
    const result = formatValidationReportJson(report);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('summary');
    expect(parsed).toHaveProperty('issues');
    expect(parsed.summary.totalIssues).toBe(4);
    expect(parsed.summary.bySeverity.error).toBe(2);
    expect(parsed.summary.bySeverity.warning).toBe(1);
    expect(parsed.summary.bySeverity.info).toBe(1);
  });

  it('includes all severities in issues array', () => {
    const report = makeReport();
    const parsed = JSON.parse(formatValidationReportJson(report));
    const severities = parsed.issues.map((i: { severity: string }) => i.severity);
    expect(severities).toContain('error');
    expect(severities).toContain('warning');
    expect(severities).toContain('info');
  });

  it('preserves the original issue order', () => {
    const report = makeReport();
    const parsed = JSON.parse(formatValidationReportJson(report));
    expect(parsed.issues.map((i: { message: string }) => i.message)).toEqual([
      'must be positive',
      'required',
      'suspicious value',
      'unusual format',
    ]);
  });

  it('returns valid JSON for an empty report', () => {
    const report = new ValidationReport();
    const parsed = JSON.parse(formatValidationReportJson(report));
    expect(parsed.summary.totalIssues).toBe(0);
    expect(parsed.issues).toHaveLength(0);
  });
});

describe('formatValidationReportMarkdown', () => {
  it('contains pipe characters and a separator row', () => {
    const report = makeReport();
    const result = formatValidationReportMarkdown(report);
    expect(result).toContain('|');
    expect(result).toContain('---');
  });

  it('has one data row per field with issues', () => {
    const report = makeReport();
    const result = formatValidationReportMarkdown(report);
    const dataLines = result.split('\n').slice(2);
    expect(dataLines).toHaveLength(3); // age, name, email
  });

  it('includes field names and counts', () => {
    const report = makeReport();
    const result = formatValidationReportMarkdown(report);
    expect(result).toContain('age');
    expect(result).toContain('name');
    expect(result).toContain('email');
  });

  it('returns a header-only table for an empty report', () => {
    const report = new ValidationReport();
    const result = formatValidationReportMarkdown(report);
    expect(result).toContain('|');
    expect(result).toContain('---');
    const lines = result.split('\n');
    expect(lines).toHaveLength(2); // header + separator only
  });
});

describe('formatValidationReportCsv', () => {
  it('first line is the header row', () => {
    const report = makeReport();
    const result = formatValidationReportCsv(report);
    const firstLine = result.split('\n')[0];
    expect(firstLine).toBe('row,field,severity,message,value');
  });

  it('has one data row per issue', () => {
    const report = makeReport();
    const lines = formatValidationReportCsv(report).split('\n');
    expect(lines).toHaveLength(5); // header + 4 issues
  });

  it('returns empty string for an empty report', () => {
    const report = new ValidationReport();
    expect(formatValidationReportCsv(report)).toBe('');
  });

  it('escapes fields containing commas', () => {
    const report = new ValidationReport();
    report.addResult({
      valid: false,
      issues: [{ field: 'notes', message: 'must be, valid', severity: 'error', row: 0 }],
    });
    const result = formatValidationReportCsv(report);
    expect(result).toContain('"must be, valid"');
  });

  it('handles issues without row or value', () => {
    const report = new ValidationReport();
    report.addResult({
      valid: false,
      issues: [{ field: 'x', message: 'missing', severity: 'error' }],
    });
    const lines = formatValidationReportCsv(report).split('\n');
    expect(lines[1]).toMatch(/^,x,error,missing,$/);
  });

  it('neutralizes spreadsheet formula cells', () => {
    const report = new ValidationReport();
    report.addResult({
      valid: false,
      issues: [
        {
          field: '=cmd',
          message: '@danger',
          severity: 'error',
          row: 0,
          value: '+1',
        },
      ],
    });
    const lines = formatValidationReportCsv(report).split('\n');
    expect(lines[1]).toBe("0,'=cmd,error,'@danger,'+1");
  });
});

describe('summarize', () => {
  it('produces summary statistics', () => {
    const result = summarize(sampleData);
    expect(result).toContain('Records: 2');
    expect(result).toContain('Columns: 3');
  });

  it('handles empty dataset', () => {
    expect(summarize([])).toBe('Empty dataset');
  });
});
