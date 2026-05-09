import { ChartData, ChartDataPoint, DataRecord, DataSet, DataValue, TableOptions } from '../types';

const DEFAULT_TABLE_OPTIONS: Required<TableOptions> = {
  headers: true,
  padding: 1,
  maxWidth: 120,
  alignment: {},
};

/**
 * Format a dataset as an ASCII table.
 */
export function formatTable(data: DataSet, options?: TableOptions): string {
  if (data.length === 0) return '(empty)';

  const opts = { ...DEFAULT_TABLE_OPTIONS, ...options };
  const columns = Object.keys(data[0]);

  // Calculate column widths
  const widths: Record<string, number> = {};
  for (const col of columns) {
    widths[col] = col.length;
    for (const record of data) {
      const val = formatValue(record[col]);
      widths[col] = Math.max(widths[col], val.length);
    }
  }

  // Apply max width constraint
  const totalWidth = Object.values(widths).reduce((a, b) => a + b, 0) + (columns.length - 1) * (opts.padding * 2 + 1);
  if (totalWidth > opts.maxWidth) {
    const scale = opts.maxWidth / totalWidth;
    for (const col of columns) {
      widths[col] = Math.max(3, Math.floor(widths[col] * scale));
    }
  }

  const pad = ' '.repeat(opts.padding);
  const separator = columns.map(col => '-'.repeat(widths[col])).join(`${pad}+${pad}`);

  const lines: string[] = [];

  if (opts.headers) {
    const headerLine = columns
      .map(col => alignCell(col, widths[col], opts.alignment[col] ?? 'left'))
      .join(`${pad}|${pad}`);
    lines.push(headerLine);
    lines.push(separator);
  }

  for (const record of data) {
    const row = columns
      .map(col => {
        const val = formatValue(record[col]);
        const truncated = val.length > widths[col] ? val.slice(0, widths[col] - 2) + '..' : val;
        return alignCell(truncated, widths[col], opts.alignment[col] ?? 'left');
      })
      .join(`${pad}|${pad}`);
    lines.push(row);
  }

  return lines.join('\n');
}

function formatValue(value: DataValue): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function alignCell(text: string, width: number, alignment: 'left' | 'right' | 'center'): string {
  const diff = width - text.length;
  if (diff <= 0) return text;

  switch (alignment) {
    case 'right':
      return ' '.repeat(diff) + text;
    case 'center': {
      const left = Math.floor(diff / 2);
      const right = diff - left;
      return ' '.repeat(left) + text + ' '.repeat(right);
    }
    default:
      return text + ' '.repeat(diff);
  }
}

/**
 * Convert a dataset to chart-ready data format.
 */
export function toChartData(
  data: DataSet,
  labelField: string,
  valueField: string,
  groupField?: string
): ChartData {
  const points: ChartDataPoint[] = [];

  for (const record of data) {
    const label = String(record[labelField] ?? '');
    const value = typeof record[valueField] === 'number' ? record[valueField] as number : 0;
    const group = groupField ? String(record[groupField] ?? '') : undefined;
    points.push({ label, value, group });
  }

  return {
    points,
    xAxis: labelField,
    yAxis: valueField,
  };
}

/**
 * Export dataset as CSV string.
 */
export function toCsv(data: DataSet, options?: { delimiter?: string; headers?: boolean }): string {
  if (data.length === 0) return '';

  const delimiter = options?.delimiter ?? ',';
  const includeHeaders = options?.headers !== false;
  const columns = Object.keys(data[0]);
  const lines: string[] = [];

  if (includeHeaders) {
    lines.push(columns.map(col => escapeCsvField(col, delimiter)).join(delimiter));
  }

  for (const record of data) {
    const row = columns.map(col => escapeCsvField(formatValue(record[col]), delimiter));
    lines.push(row.join(delimiter));
  }

  return lines.join('\n');
}

function escapeCsvField(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export dataset as JSON string with formatting options.
 */
export function toJson(
  data: DataSet,
  options?: { pretty?: boolean; arrayWrap?: boolean }
): string {
  const pretty = options?.pretty !== false;
  const arrayWrap = options?.arrayWrap !== false;

  if (arrayWrap) {
    return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  }

  // NDJSON format
  return data.map(record => JSON.stringify(record)).join('\n');
}

/**
 * Format dataset as a simple markdown table.
 */
export function toMarkdown(data: DataSet): string {
  if (data.length === 0) return '';

  const columns = Object.keys(data[0]);
  const lines: string[] = [];

  // Header
  lines.push('| ' + columns.join(' | ') + ' |');
  lines.push('| ' + columns.map(() => '---').join(' | ') + ' |');

  // Rows
  for (const record of data) {
    const row = columns.map(col => formatValue(record[col]).replace(/\|/g, '\\|'));
    lines.push('| ' + row.join(' | ') + ' |');
  }

  return lines.join('\n');
}

/**
 * Format dataset as a summary with statistics.
 */
export function summarize(data: DataSet): string {
  if (data.length === 0) return 'Empty dataset';

  const columns = Object.keys(data[0]);
  const lines: string[] = [];
  lines.push(`Records: ${data.length}`);
  lines.push(`Columns: ${columns.length} (${columns.join(', ')})`);
  lines.push('');

  for (const col of columns) {
    const values = data.map(r => r[col]).filter(v => v !== null && v !== undefined);
    const nullCount = data.length - values.length;
    const nums = values.filter((v): v is number => typeof v === 'number');

    let stats = `  ${col}: ${values.length} values`;
    if (nullCount > 0) stats += `, ${nullCount} null`;
    if (nums.length > 0) {
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      stats += ` | min=${min}, max=${max}, avg=${avg.toFixed(2)}`;
    }
    lines.push(stats);
  }

  return lines.join('\n');
}
