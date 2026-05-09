import { DataRecord, DataValue, JsonStreamOptions, ParseResult, StreamEvent } from '../types';

const DEFAULT_OPTIONS: Required<JsonStreamOptions> = {
  path: '',
  onError: 'collect',
};

/**
 * Extract a nested value from an object using dot-notation path.
 */
function extractPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Flatten a nested object into a flat DataRecord.
 * Nested keys are joined with dots.
 */
function flattenObject(obj: Record<string, unknown>, prefix = ''): DataRecord {
  const result: DataRecord = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      result[fullKey] = JSON.stringify(value) as DataValue;
    } else {
      result[fullKey] = value as DataValue;
    }
  }
  return result;
}

/**
 * Parse a JSON string, optionally extracting a nested array path.
 * Supports error recovery with partial results.
 */
export function parseJson(input: string, options?: JsonStreamOptions): ParseResult<DataRecord[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const warnings: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    return {
      success: false,
      error: `JSON parse error: ${(e as Error).message}`,
      warnings,
    };
  }

  const target = opts.path ? extractPath(parsed, opts.path) : parsed;

  if (!Array.isArray(target)) {
    // Try to handle single object
    if (target !== null && typeof target === 'object') {
      const record = flattenObject(target as Record<string, unknown>);
      return { success: true, data: [record], warnings };
    }
    return {
      success: false,
      error: opts.path
        ? `Path "${opts.path}" does not resolve to an array`
        : 'Input is not an array or object',
      warnings,
    };
  }

  const records: DataRecord[] = [];
  for (let i = 0; i < target.length; i++) {
    const item = target[i];
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      warnings.push(`Item ${i}: not an object, skipped`);
      continue;
    }
    records.push(flattenObject(item as Record<string, unknown>));
  }

  return { success: true, data: records, warnings };
}

/**
 * Streaming JSON parser - processes NDJSON (newline-delimited JSON) line by line.
 * Each line is expected to be a valid JSON object.
 */
export function parseJsonStream(
  input: string,
  callback: (event: StreamEvent<DataRecord>) => void,
  options?: JsonStreamOptions
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines = input.split(/\r?\n/).filter(l => l.trim() !== '');
  let totalRecords = 0;
  let errors = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (e) {
      errors++;
      callback({ type: 'error', message: `Line ${i + 1}: ${(e as Error).message}`, line: i + 1 });
      if (opts.onError === 'stop') break;
      continue;
    }

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      errors++;
      callback({ type: 'error', message: `Line ${i + 1}: not an object`, line: i + 1 });
      if (opts.onError === 'stop') break;
      continue;
    }

    let target: unknown = parsed;
    if (opts.path) {
      target = extractPath(parsed, opts.path);
      if (target === undefined) {
        errors++;
        callback({ type: 'error', message: `Line ${i + 1}: path not found`, line: i + 1 });
        if (opts.onError === 'stop') break;
        continue;
      }
    }

    if (target !== null && typeof target === 'object' && !Array.isArray(target)) {
      const record = flattenObject(target as Record<string, unknown>);
      totalRecords++;
      callback({ type: 'data', record });
    } else {
      errors++;
      callback({ type: 'error', message: `Line ${i + 1}: extracted value is not an object`, line: i + 1 });
      if (opts.onError === 'stop') break;
    }
  }

  callback({ type: 'end', totalRecords, errors });
}
