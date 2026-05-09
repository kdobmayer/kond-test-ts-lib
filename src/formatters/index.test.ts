import { formatTable, toChartData, toCsv, toJson, toMarkdown, summarize } from './index';
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
