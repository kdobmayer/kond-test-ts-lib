import {
  AggregateFunction,
  AggregateSpec,
  DataRecord,
  DataSet,
  DataValue,
  JoinSpec,
  JoinType,
  PivotSpec,
  WindowSpec,
} from '../types';

/**
 * Map transform - apply a function to each record.
 */
export function map<T extends DataRecord = DataRecord>(
  data: T[],
  fn: (record: T, index: number) => DataRecord
): DataRecord[] {
  return data.map((record, index) => fn(record, index));
}

/**
 * Filter transform - keep records matching a predicate.
 */
export function filter<T extends DataRecord = DataRecord>(
  data: T[],
  predicate: (record: T, index: number) => boolean
): T[] {
  return data.filter((record, index) => predicate(record, index));
}

/**
 * Select specific fields from records.
 */
export function select(data: DataSet, fields: string[]): DataSet {
  return data.map(record => {
    const result: DataRecord = {};
    for (const field of fields) {
      if (field in record) {
        result[field] = record[field];
      }
    }
    return result;
  });
}

/**
 * Rename fields in records.
 */
export function rename(data: DataSet, mapping: Record<string, string>): DataSet {
  return data.map(record => {
    const result: DataRecord = {};
    for (const [key, value] of Object.entries(record)) {
      const newKey = mapping[key] ?? key;
      result[newKey] = value;
    }
    return result;
  });
}

function computeAggregate(values: DataValue[], fn: AggregateFunction): DataValue {
  const nums = values.filter((v): v is number => typeof v === 'number');

  switch (fn) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0);
    case 'avg':
      return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    case 'min':
      return nums.length > 0 ? Math.min(...nums) : null;
    case 'max':
      return nums.length > 0 ? Math.max(...nums) : null;
    case 'count':
      return values.length;
    case 'first':
      return values.length > 0 ? values[0] : null;
    case 'last':
      return values.length > 0 ? values[values.length - 1] : null;
  }
}

/**
 * Group records by a key and compute aggregates.
 */
export function aggregate(
  data: DataSet,
  groupBy: string | string[],
  specs: AggregateSpec[]
): DataSet {
  const groupKeys = Array.isArray(groupBy) ? groupBy : [groupBy];
  const groups = new Map<string, DataRecord[]>();

  for (const record of data) {
    const key = groupKeys.map(k => String(record[k] ?? '')).join('|');
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  const results: DataSet = [];
  for (const [, group] of groups) {
    const result: DataRecord = {};

    // Include group keys
    for (const key of groupKeys) {
      result[key] = group[0][key];
    }

    // Compute aggregates
    for (const spec of specs) {
      const values = group.map(r => r[spec.field]);
      const alias = spec.alias ?? `${spec.fn}_${spec.field}`;
      result[alias] = computeAggregate(values, spec.fn);
    }

    results.push(result);
  }

  return results;
}

/**
 * Pivot transform - rotate rows into columns.
 * Intentionally has NO tests (rough edge).
 */
export function pivot(data: DataSet, spec: PivotSpec): DataSet {
  const { rowKey, columnKey, valueKey, aggregateFn = 'sum' } = spec;
  const pivotMap = new Map<string, Map<string, DataValue[]>>();
  const allColumns = new Set<string>();

  for (const record of data) {
    const row = String(record[rowKey] ?? '');
    const col = String(record[columnKey] ?? '');
    const val = record[valueKey];

    allColumns.add(col);

    if (!pivotMap.has(row)) {
      pivotMap.set(row, new Map());
    }
    const rowMap = pivotMap.get(row)!;
    if (!rowMap.has(col)) {
      rowMap.set(col, []);
    }
    rowMap.get(col)!.push(val);
  }

  const results: DataSet = [];
  for (const [rowVal, rowMap] of pivotMap) {
    const result: DataRecord = { [rowKey]: rowVal };
    for (const col of allColumns) {
      const values = rowMap.get(col) ?? [];
      result[col] = values.length > 0 ? computeAggregate(values, aggregateFn) : null;
    }
    results.push(result);
  }

  return results;
}

/**
 * Join two datasets on specified keys.
 */
export function join(left: DataSet, right: DataSet, spec: JoinSpec): DataSet {
  const { type, leftKey, rightKey, prefix } = spec;
  const leftPrefix = prefix?.left ?? '';
  const rightPrefix = prefix?.right ?? '';

  // Build index on right dataset
  const rightIndex = new Map<string, DataRecord[]>();
  for (const record of right) {
    const key = String(record[rightKey] ?? '');
    const existing = rightIndex.get(key) ?? [];
    existing.push(record);
    rightIndex.set(key, existing);
  }

  const results: DataSet = [];

  function prefixRecord(record: DataRecord, pfx: string): DataRecord {
    if (!pfx) return { ...record };
    const result: DataRecord = {};
    for (const [k, v] of Object.entries(record)) {
      result[`${pfx}${k}`] = v;
    }
    return result;
  }

  function emptyRecord(template: DataRecord, pfx: string): DataRecord {
    const result: DataRecord = {};
    for (const k of Object.keys(template)) {
      result[`${pfx}${k}`] = null;
    }
    return result;
  }

  const rightTemplate = right.length > 0 ? right[0] : {};
  const leftTemplate = left.length > 0 ? left[0] : {};

  // Process left records
  const matchedRight = new Set<string>();

  for (const leftRecord of left) {
    const key = String(leftRecord[leftKey] ?? '');
    const matches = rightIndex.get(key);

    if (matches && matches.length > 0) {
      matchedRight.add(key);
      for (const rightRecord of matches) {
        results.push({
          ...prefixRecord(leftRecord, leftPrefix),
          ...prefixRecord(rightRecord, rightPrefix),
        });
      }
    } else if (type === 'left' || type === 'full') {
      results.push({
        ...prefixRecord(leftRecord, leftPrefix),
        ...emptyRecord(rightTemplate, rightPrefix),
      });
    }
  }

  // For right/full joins, add unmatched right records
  if (type === 'right' || type === 'full') {
    for (const rightRecord of right) {
      const key = String(rightRecord[rightKey] ?? '');
      if (!matchedRight.has(key)) {
        results.push({
          ...emptyRecord(leftTemplate, leftPrefix),
          ...prefixRecord(rightRecord, rightPrefix),
        });
      }
    }
  }

  return results;
}

/**
 * Sort records by one or more fields.
 */
export function sort(data: DataSet, fields: Array<{ field: string; order?: 'asc' | 'desc' }>): DataSet {
  return [...data].sort((a, b) => {
    for (const { field, order = 'asc' } of fields) {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal === bVal) continue;
      if (aVal === null || aVal === undefined) return order === 'asc' ? -1 : 1;
      if (bVal === null || bVal === undefined) return order === 'asc' ? 1 : -1;
      const cmp = aVal < bVal ? -1 : 1;
      return order === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

/**
 * Deduplicate records by specified key fields.
 */
export function deduplicate(data: DataSet, keys: string[]): DataSet {
  const seen = new Set<string>();
  return data.filter(record => {
    const key = keys.map(k => String(record[k] ?? '')).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseDuration(duration: string): number {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/.exec(duration);
  if (!match) throw new Error(`Invalid window duration: "${duration}". Expected format: <number><unit> where unit is ms, s, m, h, or d.`);
  const value = parseFloat(match[1]);
  let durationMs: number;
  switch (match[2]) {
    case 'ms': durationMs = value; break;
    case 's':  durationMs = value * 1_000; break;
    case 'm':  durationMs = value * 60_000; break;
    case 'h':  durationMs = value * 3_600_000; break;
    case 'd':  durationMs = value * 86_400_000; break;
    default:   throw new Error(`Unknown duration unit: "${match[2]}"`);
  }

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(`Invalid window duration: "${duration}". Duration must be greater than zero.`);
  }

  return durationMs;
}

function resolveTimestamp(value: DataValue): number | null {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

/**
 * Window transformer for time-series data.
 * Produces one output record per non-empty window containing aggregated values.
 * Window intervals are half-open: [windowStart, windowEnd).
 */
export function windowTransform(data: DataSet, spec: WindowSpec): DataSet {
  if (data.length === 0) return [];

  const { field, size, type = 'tumbling', step, aggregate: aggSpecs } = spec;
  if (type !== 'tumbling' && type !== 'sliding') {
    throw new Error(`Invalid window type: "${String(type)}". Expected "tumbling" or "sliding".`);
  }

  const sizeMs = parseDuration(size);
  const stepMs = type === 'sliding' && step ? parseDuration(step) : sizeMs;

  const timestamped = data
    .map(record => ({ record, ts: resolveTimestamp(record[field]) }))
    .filter((item): item is { record: DataRecord; ts: number } => item.ts !== null);

  if (timestamped.length === 0) return [];

  const minTs = timestamped.reduce((min, d) => Math.min(min, d.ts), Infinity);
  const maxTs = timestamped.reduce((max, d) => Math.max(max, d.ts), -Infinity);
  const firstWindowStart = Math.floor(minTs / stepMs) * stepMs;

  const results: DataSet = [];

  for (let windowStart = firstWindowStart; windowStart <= maxTs; windowStart += stepMs) {
    const windowEnd = windowStart + sizeMs;
    const windowRecords = timestamped
      .filter(d => d.ts >= windowStart && d.ts < windowEnd)
      .map(d => d.record);

    if (windowRecords.length === 0) continue;

    const result: DataRecord = {
      windowStart: new Date(windowStart).toISOString(),
      windowEnd: new Date(windowEnd).toISOString(),
    };

    for (const aggSpec of aggSpecs) {
      const values = windowRecords.map(r => r[aggSpec.field]);
      const alias = aggSpec.alias ?? `${aggSpec.fn}_${aggSpec.field}`;
      result[alias] = computeAggregate(values, aggSpec.fn);
    }

    results.push(result);
  }

  return results;
}
