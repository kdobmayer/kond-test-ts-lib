import { PluginRegistry } from './index';
import { TransformerPlugin, ValidatorPlugin } from '../types';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe('transformers', () => {
    const uppercasePlugin: TransformerPlugin = {
      name: 'uppercase',
      description: 'Uppercases all string values',
      transform(data) {
        return data.map(record => {
          const result = { ...record };
          for (const [k, v] of Object.entries(result)) {
            if (typeof v === 'string') result[k] = v.toUpperCase();
          }
          return result;
        });
      },
    };

    it('registers and retrieves a transformer', () => {
      registry.registerTransformer(uppercasePlugin);
      expect(registry.getTransformer('uppercase')).toBe(uppercasePlugin);
    });

    it('throws on duplicate registration', () => {
      registry.registerTransformer(uppercasePlugin);
      expect(() => registry.registerTransformer(uppercasePlugin)).toThrow();
    });

    it('applies a transformer', () => {
      registry.registerTransformer(uppercasePlugin);
      const result = registry.applyTransformer('uppercase', [{ name: 'alice' }]);
      expect(result[0].name).toBe('ALICE');
    });

    it('throws on unknown transformer', () => {
      expect(() => registry.applyTransformer('unknown', [])).toThrow();
    });

    it('lists registered transformers', () => {
      registry.registerTransformer(uppercasePlugin);
      expect(registry.listTransformers()).toEqual(['uppercase']);
    });
  });

  describe('validators', () => {
    const nonEmptyPlugin: ValidatorPlugin = {
      name: 'non-empty',
      validate(record) {
        const issues = Object.entries(record)
          .filter(([, v]) => v === null || v === undefined || v === '')
          .map(([field]) => ({
            field,
            message: `${field} must not be empty`,
            severity: 'error' as const,
          }));
        return { valid: issues.length === 0, issues };
      },
    };

    it('registers and applies a validator', () => {
      registry.registerValidator(nonEmptyPlugin);
      const result = registry.applyValidator('non-empty', [{ name: 'Alice' }, { name: '' }]);
      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
    });

    it('throws on unknown validator', () => {
      expect(() => registry.applyValidator('unknown', [])).toThrow();
    });
  });

  it('clears all plugins', () => {
    registry.registerTransformer({ name: 't1', transform: (d) => d });
    registry.registerValidator({ name: 'v1', validate: () => ({ valid: true, issues: [] }) });
    registry.clear();
    expect(registry.listTransformers()).toHaveLength(0);
    expect(registry.listValidators()).toHaveLength(0);
  });
});
