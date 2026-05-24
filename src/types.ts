/** Core types for the data transformation library */

export type DataValue = string | number | boolean | null | undefined;
export type DataRecord = Record<string, DataValue>;
export type DataSet = DataRecord[];

/** Discriminated union for parse results */
export type ParseResult<T> =
  | { success: true; data: T; warnings: string[] }
  | { success: false; error: string; partial?: T; warnings: string[] };

/** Streaming event types */
export type StreamEvent<T> =
  | { type: 'data'; record: T }
  | { type: 'error'; message: string; line?: number }
  | { type: 'end'; totalRecords: number; errors: number };

/** Plugin system types */
export interface TransformerPlugin<TIn = DataRecord, TOut = DataRecord> {
  name: string;
  description?: string;
  transform(data: TIn[], options?: Record<string, unknown>): TOut[];
}

export interface ValidatorPlugin<T = DataRecord> {
  name: string;
  description?: string;
  validate(record: T, context?: ValidationContext): ValidationResult;
}

export interface ValidationContext {
  rowIndex: number;
  fieldName?: string;
  allRecords?: DataRecord[];
}

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  field: string;
  message: string;
  severity: ValidationSeverity;
  value?: DataValue;
  row?: number;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/** Schema definition for validation */
export type SchemaFieldType = 'string' | 'number' | 'boolean' | 'date' | 'email' | 'url';

export interface SchemaField {
  type: SchemaFieldType;
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: DataValue[];
  custom?: (value: DataValue) => boolean;
}

export type Schema = Record<string, SchemaField>;

/** Formatter options */
export interface TableOptions {
  headers?: boolean;
  padding?: number;
  maxWidth?: number;
  alignment?: Record<string, 'left' | 'right' | 'center'>;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  group?: string;
}

export interface ChartData {
  title?: string;
  points: ChartDataPoint[];
  xAxis?: string;
  yAxis?: string;
}

/** Aggregation types */
export type AggregateFunction = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'first' | 'last';

export interface AggregateSpec {
  field: string;
  fn: AggregateFunction;
  alias?: string;
}

/** Join types */
export type JoinType = 'inner' | 'left' | 'right' | 'full';

export interface JoinSpec {
  type: JoinType;
  leftKey: string;
  rightKey: string;
  prefix?: { left?: string; right?: string };
}

/** Pivot spec */
export interface PivotSpec {
  rowKey: string;
  columnKey: string;
  valueKey: string;
  aggregateFn?: AggregateFunction;
}

/** CSV parser options */
export interface CsvOptions {
  delimiter?: string;
  quote?: string;
  escape?: string;
  headers?: boolean | string[];
  skipEmpty?: boolean;
  encoding?: string;
  onError?: 'skip' | 'stop' | 'collect';
}

/** JSON stream parser options */
export interface JsonStreamOptions {
  path?: string;
  onError?: 'skip' | 'stop' | 'collect';
}

/** XML parser options */
export interface XmlOptions {
  arrayTags?: string[];
  attributePrefix?: string;
  textKey?: string;
  onError?: 'skip' | 'stop' | 'collect';
}

/** Aggregate statistics from a ValidationReport */
export interface ValidationReportSummary {
  totalIssues: number;
  byField: Record<string, number>;
  byRow: Record<number, number>;
  bySeverity: Record<ValidationSeverity, number>;
  passCount: number;
  failCount: number;
}

export interface ValidationReportAddOptions {
  source?: string;
  totalRows?: number;
}

/** Options for the Pipeline */
export interface PipelineOptions {
  maxErrors?: number;
}
