import {
  AggregateFunction,
  AggregateSpec,
  DataRecord,
  DataSet,
  DataValue,
  JoinSpec,
  JoinType,
  PivotSpec,
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
 * Flatten nested objects into dot-notation key-value pairs.
 * Non-plain-object leaves are converted into DataValue-compatible primitives.
 */
export function flatten(data: Record<string, unknown>[], separator = '.'): DataSet {
  function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function stringifySafely(value: unknown): string {
    const seen = new WeakSet<object>();
    return JSON.stringify(value, (_key, nestedValue) => {
      if (typeof nestedValue === 'bigint') {
        return nestedValue.toString();
      }

      if (nestedValue !== null && typeof nestedValue === 'object') {
        if (seen.has(nestedValue)) {
          return '[Circular]';
        }
        seen.add(nestedValue);
      }

      return nestedValue;
    }) ?? String(value);
  }

  function toDataValue(value: unknown): DataValue {
    if (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    return stringifySafely(value);
  }

  function setFlattenedValue(result: DataRecord, key: string, value: DataValue): void {
    if (key in result) {
      throw new Error(`Flatten key collision for "${key}"`);
    }
    result[key] = value;
  }

  function flattenRecord(record: Record<string, unknown>, prefix: string, ancestors: WeakSet<object>): DataRecord {
    const result: DataRecord = {};
    for (const [key, value] of Object.entries(record)) {
      const fullKey = prefix ? `${prefix}${separator}${key}` : key;

      if (isPlainObject(value)) {
        if (ancestors.has(value)) {
          setFlattenedValue(result, fullKey, '[Circular]');
          continue;
        }

        ancestors.add(value);
        const nested = flattenRecord(value, fullKey, ancestors);
        ancestors.delete(value);

        for (const [nestedKey, nestedValue] of Object.entries(nested)) {
          setFlattenedValue(result, nestedKey, nestedValue);
        }
      } else {
        setFlattenedValue(result, fullKey, toDataValue(value));
      }
    }
    return result;
  }

  return data.map(record => {
    const ancestors = new WeakSet<object>();
    ancestors.add(record);
    return flattenRecord(record, '', ancestors);
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
