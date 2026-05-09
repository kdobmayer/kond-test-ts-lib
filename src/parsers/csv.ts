import { CsvOptions, DataRecord, DataValue, ParseResult, StreamEvent } from '../types';

const DEFAULT_OPTIONS: Required<CsvOptions> = {
  delimiter: ',',
  quote: '"',
  escape: '"',
  headers: true,
  skipEmpty: true,
  encoding: 'utf-8',
  onError: 'collect',
};

/**
 * Parse a single CSV line respecting quotes and escapes.
 * Returns null if the line is incomplete (unclosed quote).
 */
function parseLine(line: string, delimiter: string, quote: string, escape: string): string[] | null {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === escape && i + 1 < line.length && line[i + 1] === quote) {
        current += quote;
        i += 2;
      } else if (ch === quote) {
        inQuotes = false;
        i++;
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === quote) {
        inQuotes = true;
        i++;
      } else if (ch === delimiter) {
        fields.push(current);
        current = '';
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }

  if (inQuotes) return null; // unclosed quote
  fields.push(current);
  return fields;
}

function coerceValue(raw: string): DataValue {
  if (raw === '') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const num = Number(raw);
  if (!isNaN(num) && raw.trim() !== '') return num;
  return raw;
}

/**
 * Parse CSV string into DataRecord array.
 * Supports error recovery with partial results.
 */
export function parseCsv(input: string, options?: CsvOptions): ParseResult<DataRecord[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines = input.split(/\r?\n/);
  const warnings: string[] = [];
  const records: DataRecord[] = [];

  let headers: string[];
  let startLine: number;

  if (Array.isArray(opts.headers)) {
    headers = opts.headers;
    startLine = 0;
  } else if (opts.headers) {
    const headerLine = lines[0];
    if (!headerLine) {
      return { success: false, error: 'Empty input: no header row', warnings };
    }
    const parsed = parseLine(headerLine, opts.delimiter, opts.quote, opts.escape);
    if (!parsed) {
      return { success: false, error: 'Malformed header row: unclosed quote', warnings };
    }
    headers = parsed.map(h => h.trim());
    startLine = 1;
  } else {
    // No headers - use numeric indices
    headers = [];
    startLine = 0;
  }

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    if (opts.skipEmpty && (!line || line.trim() === '')) continue;

    const fields = parseLine(line, opts.delimiter, opts.quote, opts.escape);
    if (!fields) {
      const msg = `Line ${i + 1}: unclosed quote`;
      if (opts.onError === 'stop') {
        return { success: false, error: msg, partial: records, warnings };
      }
      warnings.push(msg);
      continue;
    }

    // Auto-generate headers if needed
    if (headers.length === 0) {
      headers = fields.map((_, idx) => `col${idx}`);
    }

    const record: DataRecord = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = j < fields.length ? coerceValue(fields[j]) : null;
    }

    // Extra fields warning
    if (fields.length > headers.length) {
      warnings.push(`Line ${i + 1}: ${fields.length - headers.length} extra field(s) ignored`);
    }

    records.push(record);
  }

  return { success: true, data: records, warnings };
}

/**
 * Streaming CSV parser - processes line by line and emits events.
 * Supports backpressure via callback return value.
 */
export function parseCsvStream(
  input: string,
  callback: (event: StreamEvent<DataRecord>) => void,
  options?: CsvOptions
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines = input.split(/\r?\n/);
  let headers: string[];
  let startLine: number;
  let totalRecords = 0;
  let errors = 0;

  if (Array.isArray(opts.headers)) {
    headers = opts.headers;
    startLine = 0;
  } else if (opts.headers) {
    const headerLine = lines[0];
    if (!headerLine) {
      callback({ type: 'error', message: 'Empty input', line: 0 });
      callback({ type: 'end', totalRecords: 0, errors: 1 });
      return;
    }
    const parsed = parseLine(headerLine, opts.delimiter, opts.quote, opts.escape);
    if (!parsed) {
      callback({ type: 'error', message: 'Malformed header', line: 1 });
      callback({ type: 'end', totalRecords: 0, errors: 1 });
      return;
    }
    headers = parsed.map(h => h.trim());
    startLine = 1;
  } else {
    headers = [];
    startLine = 0;
  }

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    if (opts.skipEmpty && (!line || line.trim() === '')) continue;

    const fields = parseLine(line, opts.delimiter, opts.quote, opts.escape);
    if (!fields) {
      errors++;
      callback({ type: 'error', message: 'Unclosed quote', line: i + 1 });
      if (opts.onError === 'stop') break;
      continue;
    }

    if (headers.length === 0) {
      headers = fields.map((_, idx) => `col${idx}`);
    }

    const record: DataRecord = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = j < fields.length ? coerceValue(fields[j]) : null;
    }

    totalRecords++;
    callback({ type: 'data', record });
  }

  callback({ type: 'end', totalRecords, errors });
}
