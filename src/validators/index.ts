import {
  DataRecord,
  DataValue,
  Schema,
  SchemaField,
  SchemaFieldType,
  ValidationContext,
  ValidationIssue,
  ValidationResult,
} from '../types';

export { ValidationReport } from './report';

// Intentional rough edge: duplicated type guard functions
// These exist in both validateSchema and validateCustomRules

function isString(value: DataValue): value is string {
  return typeof value === 'string';
}

function isNumber(value: DataValue): value is number {
  return typeof value === 'number';
}

function isBoolean(value: DataValue): value is boolean {
  return typeof value === 'boolean';
}

function isNullish(value: DataValue): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Coerce a value to the specified type.
 * Returns the coerced value or null if coercion fails.
 */
export function coerceValue(value: DataValue, targetType: SchemaFieldType): DataValue {
  if (isNullish(value)) return null;

  switch (targetType) {
    case 'string':
      return String(value);
    case 'number': {
      if (typeof value === 'number') return value;
      const num = Number(value);
      return isNaN(num) ? null : num;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === '1' || value === 1) return true;
      if (value === 'false' || value === '0' || value === 0) return false;
      return null;
    }
    case 'date': {
      if (typeof value === 'string') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : value;
      }
      return null;
    }
    case 'email': {
      if (typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return value;
      }
      return null;
    }
    case 'url': {
      if (typeof value === 'string') {
        try {
          new URL(value);
          return value;
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

/**
 * Validate a single field against its schema definition.
 */
function validateField(
  value: DataValue,
  field: string,
  schema: SchemaField,
  rowIndex: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Required check
  if (schema.required && isNullish(value)) {
    issues.push({
      field,
      message: `Required field "${field}" is missing`,
      severity: 'error',
      value,
      row: rowIndex,
    });
    return issues; // No further validation on missing required field
  }

  if (isNullish(value)) return issues;

  // Type check
  const coerced = coerceValue(value, schema.type);
  if (coerced === null && !isNullish(value)) {
    issues.push({
      field,
      message: `Field "${field}" cannot be coerced to ${schema.type}`,
      severity: 'error',
      value,
      row: rowIndex,
    });
    return issues;
  }

  // Range checks (for numbers)
  if (schema.type === 'number' && typeof coerced === 'number') {
    if (schema.min !== undefined && coerced < schema.min) {
      issues.push({
        field,
        message: `Field "${field}" value ${coerced} is below minimum ${schema.min}`,
        severity: 'error',
        value: coerced,
        row: rowIndex,
      });
    }
    if (schema.max !== undefined && coerced > schema.max) {
      issues.push({
        field,
        message: `Field "${field}" value ${coerced} exceeds maximum ${schema.max}`,
        severity: 'error',
        value: coerced,
        row: rowIndex,
      });
    }
  }

  // String length checks
  if (schema.type === 'string' && typeof coerced === 'string') {
    if (schema.min !== undefined && coerced.length < schema.min) {
      issues.push({
        field,
        message: `Field "${field}" length ${coerced.length} is below minimum ${schema.min}`,
        severity: 'error',
        value: coerced,
        row: rowIndex,
      });
    }
    if (schema.max !== undefined && coerced.length > schema.max) {
      issues.push({
        field,
        message: `Field "${field}" length ${coerced.length} exceeds maximum ${schema.max}`,
        severity: 'error',
        value: coerced,
        row: rowIndex,
      });
    }
  }

  // Pattern check
  if (schema.pattern && isString(value)) {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) {
      issues.push({
        field,
        message: `Field "${field}" does not match pattern ${schema.pattern}`,
        severity: 'error',
        value,
        row: rowIndex,
      });
    }
  }

  // Enum check
  if (schema.enum && !schema.enum.includes(value)) {
    issues.push({
      field,
      message: `Field "${field}" value not in allowed values: ${schema.enum.join(', ')}`,
      severity: 'error',
      value,
      row: rowIndex,
    });
  }

  // Custom validator
  if (schema.custom && !schema.custom(value)) {
    issues.push({
      field,
      message: `Field "${field}" failed custom validation`,
      severity: 'error',
      value,
      row: rowIndex,
    });
  }

  return issues;
}

/**
 * Validate a dataset against a schema.
 */
export function validateSchema(data: DataRecord[], schema: Schema): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < data.length; i++) {
    const record = data[i];
    for (const [field, fieldSchema] of Object.entries(schema)) {
      const fieldIssues = validateField(record[field], field, fieldSchema, i);
      issues.push(...fieldIssues);
    }
  }

  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  };
}

/** Apply type coercion to a dataset based on a schema. */
export function coerceDataset(data: DataRecord[], schema: Schema): DataRecord[] {
  return data.map(record => {
    const result: DataRecord = { ...record };
    for (const [field, fieldSchema] of Object.entries(schema)) {
      if (field in result) {
        const coerced = coerceValue(result[field], fieldSchema.type);
        if (coerced !== null) {
          result[field] = coerced;
        }
      }
    }
    return result;
  });
}

/** Custom validation rule */
export interface CustomRule {
  name: string;
  field?: string;
  severity?: 'error' | 'warning' | 'info';
  validate: (value: DataValue, record: DataRecord, context: ValidationContext) => boolean;
  message: string;
}

// Intentional rough edge: duplicated type guards (same as above)
function isStringValue(value: DataValue): value is string {
  return typeof value === 'string';
}

function isNumberValue(value: DataValue): value is number {
  return typeof value === 'number';
}

function isNullishValue(value: DataValue): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Validate a dataset against custom rules.
 */
export function validateCustomRules(data: DataRecord[], rules: CustomRule[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < data.length; i++) {
    const record = data[i];
    for (const rule of rules) {
      const context: ValidationContext = { rowIndex: i, fieldName: rule.field, allRecords: data };
      const fields = rule.field ? [rule.field] : Object.keys(record);

      for (const field of fields) {
        const value = record[field];
        if (!rule.validate(value, record, context)) {
          issues.push({
            field,
            message: rule.message,
            severity: rule.severity ?? 'error',
            value,
            row: i,
          });
        }
      }
    }
  }

  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  };
}

/**
 * Combine multiple validation results.
 */
export function combineResults(...results: ValidationResult[]): ValidationResult {
  const allIssues = results.flatMap(r => r.issues);
  return {
    valid: allIssues.filter(i => i.severity === 'error').length === 0,
    issues: allIssues,
  };
}
