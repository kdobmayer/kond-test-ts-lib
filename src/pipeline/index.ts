import { DataRecord, DataSet, ValidationResult, PipelineConfig } from '../types';
import { validateSchema, validateCustomRules, CustomRule } from '../validators';
import { Schema } from '../types';

type PipelineStep =
  | { type: 'transform'; fn: (data: DataSet) => DataSet }
  | { type: 'validate'; fn: (data: DataSet) => ValidationResult }
  | { type: 'filter'; fn: (record: DataRecord, index: number) => boolean };

export interface PipelineResult {
  data: DataSet;
  validationResults: ValidationResult[];
  stepsExecuted: number;
  errors: string[];
}

const DEFAULT_CONFIG: Required<PipelineConfig> = { onError: 'collect' };

function cloneDataSet(data: DataSet): DataSet {
  return data.map((record) => ({ ...record }));
}

/**
 * Fluent pipeline builder for chaining transformations and validations.
 */
export class Pipeline {
  private steps: PipelineStep[] = [];
  private source: DataSet = [];
  private config: Required<PipelineConfig>;

  constructor(data?: DataSet, config?: PipelineConfig) {
    if (data) this.source = data;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set the input data.
   */
  from(data: DataSet): Pipeline {
    this.source = data;
    return this;
  }

  /**
   * Add a transformation step.
   */
  transform(fn: (data: DataSet) => DataSet): Pipeline {
    this.steps.push({ type: 'transform', fn });
    return this;
  }

  /**
   * Add a filter step.
   */
  filter(predicate: (record: DataRecord, index: number) => boolean): Pipeline {
    this.steps.push({ type: 'filter', fn: predicate });
    return this;
  }

  /**
   * Add a schema validation step.
   */
  validateWith(schema: Schema): Pipeline {
    this.steps.push({
      type: 'validate',
      fn: (data) => validateSchema(data, schema),
    });
    return this;
  }

  /**
   * Add custom rules validation step.
   */
  validateRules(rules: CustomRule[]): Pipeline {
    this.steps.push({
      type: 'validate',
      fn: (data) => validateCustomRules(data, rules),
    });
    return this;
  }

  /**
   * Execute the pipeline and return results.
   */
  execute(): PipelineResult {
    const onError = this.config.onError;
    let data = cloneDataSet(this.source);
    const validationResults: ValidationResult[] = [];
    const errors: string[] = [];
    let stepsExecuted = 0;

    for (const step of this.steps) {
      const stepNumber = stepsExecuted + 1;
      try {
        switch (step.type) {
          case 'transform': {
            const workingData = onError === 'skip' ? cloneDataSet(data) : data;
            data = step.fn(workingData);
            break;
          }
          case 'filter':
            if (onError === 'skip') {
              const snapshot = cloneDataSet(data);
              const kept: DataRecord[] = [];
              for (let i = 0; i < snapshot.length; i++) {
                try {
                  if (step.fn(snapshot[i], i)) kept.push(snapshot[i]);
                } catch (e) {
                  const detail = e instanceof Error ? e.message : String(e);
                  errors.push(`Step ${stepNumber}, record ${i + 1}: ${detail}`);
                }
              }
              data = kept;
            } else {
              data = data.filter((record, index) => step.fn(record, index));
            }
            break;
          case 'validate': {
            const result = step.fn(data);
            validationResults.push(result);
            break;
          }
        }
        stepsExecuted++;
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        const msg = `Step ${stepNumber}: ${detail}`;
        if (onError === 'stop') {
          throw new Error(msg);
        } else if (onError === 'skip') {
          errors.push(msg);
          stepsExecuted++;
        } else {
          errors.push(msg);
          break;
        }
      }
    }

    return { data, validationResults, stepsExecuted, errors };
  }

  /**
   * Reset the pipeline steps.
   */
  reset(): Pipeline {
    this.steps = [];
    this.source = [];
    return this;
  }
}

/**
 * Create a new pipeline with optional initial data and config.
 */
export function createPipeline(data?: DataSet, config?: PipelineConfig): Pipeline {
  return new Pipeline(data, config);
}
