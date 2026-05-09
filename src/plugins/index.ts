import { DataRecord, TransformerPlugin, ValidatorPlugin, ValidationResult } from '../types';

/**
 * Plugin registry for custom transformers and validators.
 */
export class PluginRegistry {
  private transformers = new Map<string, TransformerPlugin>();
  private validators = new Map<string, ValidatorPlugin>();

  /**
   * Register a custom transformer plugin.
   */
  registerTransformer<TIn extends DataRecord = DataRecord, TOut extends DataRecord = DataRecord>(
    plugin: TransformerPlugin<TIn, TOut>
  ): void {
    if (this.transformers.has(plugin.name)) {
      throw new Error(`Transformer "${plugin.name}" is already registered`);
    }
    this.transformers.set(plugin.name, plugin as unknown as TransformerPlugin);
  }

  /**
   * Register a custom validator plugin.
   */
  registerValidator<T extends DataRecord = DataRecord>(plugin: ValidatorPlugin<T>): void {
    if (this.validators.has(plugin.name)) {
      throw new Error(`Validator "${plugin.name}" is already registered`);
    }
    this.validators.set(plugin.name, plugin as unknown as ValidatorPlugin);
  }

  /**
   * Unregister a transformer by name.
   */
  unregisterTransformer(name: string): boolean {
    return this.transformers.delete(name);
  }

  /**
   * Unregister a validator by name.
   */
  unregisterValidator(name: string): boolean {
    return this.validators.delete(name);
  }

  /**
   * Get a registered transformer by name.
   */
  getTransformer(name: string): TransformerPlugin | undefined {
    return this.transformers.get(name);
  }

  /**
   * Get a registered validator by name.
   */
  getValidator(name: string): ValidatorPlugin | undefined {
    return this.validators.get(name);
  }

  /**
   * List all registered transformer names.
   */
  listTransformers(): string[] {
    return Array.from(this.transformers.keys());
  }

  /**
   * List all registered validator names.
   */
  listValidators(): string[] {
    return Array.from(this.validators.keys());
  }

  /**
   * Apply a registered transformer to data.
   */
  applyTransformer(name: string, data: DataRecord[], options?: Record<string, unknown>): DataRecord[] {
    const plugin = this.transformers.get(name);
    if (!plugin) {
      throw new Error(`Transformer "${name}" not found`);
    }
    return plugin.transform(data, options);
  }

  /**
   * Apply a registered validator to each record.
   */
  applyValidator(name: string, data: DataRecord[]): ValidationResult {
    const plugin = this.validators.get(name);
    if (!plugin) {
      throw new Error(`Validator "${name}" not found`);
    }

    const issues = data.flatMap((record, index) => {
      const result = plugin.validate(record, { rowIndex: index });
      return result.issues;
    });

    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Clear all registered plugins.
   */
  clear(): void {
    this.transformers.clear();
    this.validators.clear();
  }
}

/** Default global registry instance */
export const defaultRegistry = new PluginRegistry();
