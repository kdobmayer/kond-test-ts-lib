# @kond/transform-lib

A TypeScript data transformation library with streaming support, plugin system, and pipeline composition.

## Modules

### Parsers
- **CSV** — streaming and batch parsing with configurable delimiters, quote handling, error recovery
- **JSON** — batch parsing with path extraction, NDJSON streaming, nested object flattening
- **XML** — batch parsing with attribute handling, CDATA support (no streaming — loads entire document)

### Transformers
- `map` — apply function to each record
- `filter` — keep records matching predicate
- `select` — pick specific fields
- `rename` — rename fields
- `aggregate` — group-by with sum/avg/min/max/count/first/last
- `pivot` — rotate rows into columns
- `join` — inner/left/right/full joins
- `sort` — multi-field sorting
- `deduplicate` — remove duplicates by key

### Validators
- Schema validation (type checking, required fields, min/max, pattern, enum, custom)
- Type coercion (string→number, string→boolean, date/email/url validation)
- Custom rules (cross-field validation, severity levels)

### Formatters
- ASCII table output with alignment
- Chart-data format conversion
- CSV export with escaping
- JSON export (pretty, compact, NDJSON)
- Markdown table
- Dataset summary statistics

### Plugin System
- Register custom transformers and validators
- Named plugin lookup and application
- Global default registry

### Pipeline
- Fluent API for chaining transforms, filters, and validations
- Error handling with step tracking
- Composable validation results

## Usage

```typescript
import { parseCsv, filter, aggregate, formatTable, createPipeline } from '@kond/transform-lib';

const result = parseCsv(csvString);
if (result.success) {
  const pipeline = createPipeline(result.data)
    .filter(r => r.age !== null)
    .transform(data => aggregate(data, 'dept', [{ field: 'salary', fn: 'avg' }]))
    .execute();

  console.log(formatTable(pipeline.data));
}
```

## Scripts

```bash
npm run build    # TypeScript compilation
npm test         # Jest with coverage
npm run lint     # Type checking
```

## Known Limitations

- XML parser loads entire document into memory (no streaming)
- Pivot transformer has no test coverage
- Some type guard functions are duplicated across validator modules
