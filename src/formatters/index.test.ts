import {
  formatTable,
  toChartData,
  toCsv,
  toJson,
  toMarkdown,
  summarize,
  formatValidationReportJson,
  formatValidationReportMarkdown,
  formatValidationReportCsv,
} from './index';
import { DataSet } from '../types';
import { ValidationReport } from '../validators';

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

describe('formatValidationReportJson', () => {
  it('returns valid JSON with summary and issues', () => {
    const report = new ValidationReport();
    report.addIssue({ field: 'name', message: 'Required', severity: 'error', row: 0 });
    const json = formatValidationReportJson(report);
    const parsed = JSON.parse(json);
    expect(parsed.summary.errorCount).toBe(1);
    expect(parsed.summary.valid).toBe(false);
    expect(parsed.issues).toHaveLength(1);
    expect(parsed.issues[0].field).toBe('name');
  });

  it('summary.errorCount matches report getSummary', () => {
    const report = new ValidationReport();
    report.addIssue({ field: 'a', message: 'err1', severity: 'error' });
    report.addIssue({ field: 'b', message: 'err2', severity: 'error' });
    report.addIssue({ field: 'c', message: 'warn', severity: 'warning' });
    const parsed = JSON.parse(formatValidationReportJson(report));
    expect(parsed.summary.errorCount).toBe(report.getSummary().errorCount);
    expect(parsed.summary.warningCount).toBe(1);
  });

  it('returns valid JSON for empty report', () => {
    const report = new ValidationReport();
    const parsed = JSON.parse(formatValidationReportJson(report));
    expect(parsed.summary.errorCount).toBe(0);
    expect(parsed.summary.valid).toBe(true);
    expect(parsed.issues).toHaveLength(0);
  });
});

describe('formatValidationReportMarkdown', () => {
  it('contains per-severity counts in summary table', () => {
    const report = new ValidationReport();
    report.addIssue({ field: 'name', message: 'Required', severity: 'error', row: 0 });
    report.addIssue({ field: 'age', message: 'Too low', severity: 'warning', row: 1 });
    const md = formatValidationReportMarkdown(report);
    expect(md).toContain('| error | 1 |');
    expect(md).toContain('| warning | 1 |');
    expect(md).toContain('| info | 0 |');
  });

  it('contains per-field issues table rows', () => {
    const report = new ValidationReport();
    report.addIssue({ field: 'name', message: 'Required', severity: 'error', row: 0 });
    const md = formatValidationReportMarkdown(report);
    expect(md).toContain('| Field | Severity | Message | Row |');
    expect(md).toContain('| name | error | Required | 0 |');
  });

  it('escapes pipe characters in messages', () => {
    const report = new ValidationReport();
    report.addIssue({ field: 'x', message: 'a|b', severity: 'info' });
    const md = formatValidationReportMarkdown(report);
    expect(md).toContain('a\\|b');
  });

  it('replaces newlines in messages with spaces to keep table valid', () => {
    const report = new ValidationReport();
    report.addIssue({ field: 'x', message: 'line1\nline2', severity: 'error' });
    const md = formatValidationReportMarkdown(report);
    expect(md).toContain('line1 line2');
    expect(md).not.toContain('line1\nline2');
  });

  it('replaces CRLF newlines in field names with spaces', () => {
    const report = new ValidationReport();
    report.addIssue({ field: 'a\r\nb', message: 'bad', severity: 'warning' });
    const md = formatValidationReportMarkdown(report);
    expect(md).toContain('a b');
  });

  it('includes headers and zero counts for empty report', () => {
    const report = new ValidationReport();
    const md = formatValidationReportMarkdown(report);
    expect(md).toContain('| Severity | Count |');
    expect(md).toContain('| Field | Severity | Message | Row |');
    expect(md).toContain('| error | 0 |');
  });
});

describe('formatValidationReportCsv', () => {
  it('wraps messages containing commas in double quotes', () => {
    const report = new ValidationReport();
    report.addIssue({ field: 'name', message: 'value, is wrong', severity: 'error', row: 0 });
    const csv = formatValidationReportCsv(report);
    expect(csv).toContain('"value, is wrong"');
  });

  it('escapes double quotes in messages as double-double-quotes', () => {
    const report = new ValidationReport();
    report.addIssue({ field: 'name', message: 'say "hello"', severity: 'error', row: 0 });
    const csv = formatValidationReportCsv(report);
    expect(csv).toContain('"say ""hello"""');
  });

  it('returns header row only for empty report', () => {
    const report = new ValidationReport();
    expect(formatValidationReportCsv(report)).toBe('field,severity,message,row,value');
  });

  it('includes all issue columns', () => {
    const report = new ValidationReport();
    report.addIssue({ field: 'age', message: 'Too low', severity: 'warning', row: 2, value: 5 });
    const lines = formatValidationReportCsv(report).split('\n');
    expect(lines[0]).toBe('field,severity,message,row,value');
    expect(lines[1]).toBe('age,warning,Too low,2,5');
  });

  it('prefixes formula-injection values with tab to prevent spreadsheet evaluation', () => {
    const report = new ValidationReport();
    report.addIssue({ field: '=HYPERLINK("x")', message: '+SUM(1)', severity: 'error', value: '-1+2' });
    const csv = formatValidationReportCsv(report);
    const dataLine = csv.split('\n')[1];
    // Each dangerous cell is tab-prefixed then CSV-quoted
    expect(dataLine).toContain('\t=HYPERLINK');
    expect(dataLine).toContain('\t+SUM');
    expect(dataLine).toContain('\t-1+2');
  });

  it('prefixes @-prefixed values with tab', () => {
    const report = new ValidationReport();
    report.addIssue({ field: 'f', message: '@cmd /c calc', severity: 'error' });
    const csv = formatValidationReportCsv(report);
    expect(csv).toContain('\t@cmd');
  });
});
