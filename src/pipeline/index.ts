import { DataRecord, DataSet, ValidationResult } from '../types';
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

/**
 * Fluent pipeline builder for chaining transformations and validations.
 */
export class Pipeline {
  private steps: PipelineStep[] = [];
  private source: DataSet = [];

  constructor(data?: DataSet) {
    if (data) this.source = data;
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
    let data = [...this.source];
    const validationResults: ValidationResult[] = [];
    const errors: string[] = [];
    let stepsExecuted = 0;

    for (const step of this.steps) {
      try {
        switch (step.type) {
          case 'transform':
            data = step.fn(data);
            break;
          case 'filter':
            data = data.filter((record, index) => step.fn(record, index));
            break;
          case 'validate': {
            const result = step.fn(data);
            validationResults.push(result);
            break;
          }
        }
        stepsExecuted++;
      } catch (e) {
        errors.push(`Step ${stepsExecuted + 1}: ${(e as Error).message}`);
        break;
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
 * Create a new pipeline with optional initial data.
 */
export function createPipeline(data?: DataSet): Pipeline {
  return new Pipeline(data);
}
