# kond-test-ts-lib

A TypeScript library providing date-formatting and date-arithmetic utilities. Used as a benchmark test target for the KOND quality evaluation framework.

## Usage

```typescript
import { formatDate, addDays, daysBetween } from 'kond-test-ts-lib';

formatDate(new Date());           // "2024-01-15"
addDays(new Date(), 7);           // Date 7 days from now
daysBetween(dateA, dateB);        // number of days between two dates
```

## API

- `formatDate(date)` — YYYY-MM-DD
- `formatTime(date)` — HH:MM:SS
- `formatDateTime(date)` — YYYY-MM-DD HH:MM:SS
- `formatRelative(date, now?)` — "3 days ago", "in 2 hours"
- `parseDate(input)` — parse YYYY-MM-DD, returns null on invalid
- `addDays(date, days)` — add/subtract days
- `addMonths(date, months)` — add/subtract months (clamps overflow)
- `daysBetween(a, b)` — absolute day count between two dates
- `isLeapYear(year)` — boolean
- `daysInMonth(year, month)` — days in the given month (1-indexed)
- `normalizeDateInput(input)` — trim + lowercase
- `normalizeTimeInput(input)` — trim + lowercase
- `normalizeDateTimeInput(input)` — trim + lowercase

## Conventions

- Named exports only — no default exports. Every public function is exported by name from `src/index.ts`.
- All public APIs have JSDoc comments — at minimum a one-line description.
- ESLint with `@typescript-eslint/recommended` — run `npm run lint` before committing.
- Pure functions only — no I/O, no side effects, no mutable module-level state.
- Tests in `__tests__/` using Jest with `ts-jest` preset.
- One source file (`src/index.ts`) for now — split into modules when it exceeds ~500 lines.
- Strict TypeScript (`strict: true` in tsconfig) — no `any`, no implicit returns.
- The `normalizeInput` helper is duplicated across three call sites — this is intentional technical debt for benchmark testing (task S4 targets extracting it).
- Import order: external packages first, then relative imports, separated by a blank line.
- No runtime dependencies — this is a pure utility library.

## Development

```bash
npm install
npm test        # runs Jest
npm run build   # compiles to dist/
npm run lint    # runs ESLint
```

## License

MIT
