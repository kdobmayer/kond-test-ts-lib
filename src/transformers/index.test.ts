import { map, filter, select, rename, aggregate, join, sort, deduplicate, windowTransform } from './index';
import { DataSet } from '../types';

const sampleData: DataSet = [
  { name: 'Alice', age: 30, dept: 'eng' },
  { name: 'Bob', age: 25, dept: 'eng' },
  { name: 'Charlie', age: 35, dept: 'sales' },
  { name: 'Diana', age: 28, dept: 'sales' },
];

describe('map', () => {
  it('transforms each record', () => {
    const result = map(sampleData, (r) => ({ ...r, senior: (r.age as number) >= 30 }));
    expect(result[0].senior).toBe(true);
    expect(result[1].senior).toBe(false);
  });

  it('provides index to transform function', () => {
    const result = map(sampleData, (r, i) => ({ ...r, idx: i }));
    expect(result[2].idx).toBe(2);
  });
});

describe('filter', () => {
  it('keeps matching records', () => {
    const result = filter(sampleData, (r) => r.dept === 'eng');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Alice');
  });
});

describe('select', () => {
  it('picks specified fields', () => {
    const result = select(sampleData, ['name', 'age']);
    expect(Object.keys(result[0])).toEqual(['name', 'age']);
  });

  it('ignores non-existent fields', () => {
    const result = select(sampleData, ['name', 'nonexistent']);
    expect(Object.keys(result[0])).toEqual(['name']);
  });
});

describe('rename', () => {
  it('renames specified fields', () => {
    const result = rename(sampleData, { name: 'fullName', dept: 'department' });
    expect(result[0].fullName).toBe('Alice');
    expect(result[0].department).toBe('eng');
    expect(result[0].name).toBeUndefined();
  });
});

describe('aggregate', () => {
  it('groups and aggregates', () => {
    const result = aggregate(sampleData, 'dept', [
      { field: 'age', fn: 'avg', alias: 'avgAge' },
      { field: 'name', fn: 'count', alias: 'count' },
    ]);
    expect(result).toHaveLength(2);
    const eng = result.find(r => r.dept === 'eng')!;
    expect(eng.avgAge).toBe(27.5);
    expect(eng.count).toBe(2);
  });

  it('supports multiple group keys', () => {
    const data: DataSet = [
      { region: 'US', dept: 'eng', salary: 100 },
      { region: 'US', dept: 'eng', salary: 120 },
      { region: 'EU', dept: 'eng', salary: 90 },
    ];
    const result = aggregate(data, ['region', 'dept'], [{ field: 'salary', fn: 'sum' }]);
    expect(result).toHaveLength(2);
  });
});

describe('join', () => {
  const left: DataSet = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
  ];
  const right: DataSet = [
    { userId: '1', score: 95 },
    { userId: '2', score: 87 },
    { userId: '4', score: 72 },
  ];

  it('performs inner join', () => {
    const result = join(left, right, { type: 'inner', leftKey: 'id', rightKey: 'userId' });
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Alice');
    expect(result[0].score).toBe(95);
  });

  it('performs left join', () => {
    const result = join(left, right, { type: 'left', leftKey: 'id', rightKey: 'userId' });
    expect(result).toHaveLength(3);
    const charlie = result.find(r => r.name === 'Charlie')!;
    expect(charlie.score).toBeNull();
  });

  it('performs full join', () => {
    const result = join(left, right, { type: 'full', leftKey: 'id', rightKey: 'userId' });
    expect(result).toHaveLength(4);
  });
});

describe('sort', () => {
  it('sorts ascending by default', () => {
    const result = sort(sampleData, [{ field: 'age' }]);
    expect(result[0].name).toBe('Bob');
    expect(result[3].name).toBe('Charlie');
  });

  it('sorts descending', () => {
    const result = sort(sampleData, [{ field: 'age', order: 'desc' }]);
    expect(result[0].name).toBe('Charlie');
  });
});

describe('deduplicate', () => {
  it('removes duplicates by key', () => {
    const data: DataSet = [
      { id: '1', name: 'Alice' },
      { id: '1', name: 'Alice2' },
      { id: '2', name: 'Bob' },
    ];
    const result = deduplicate(data, ['id']);
    expect(result).toHaveLength(2);
  });
});

// NOTE: pivot transformer intentionally has ZERO tests (rough edge)

describe('windowTransform', () => {
  // Base time: 2024-01-01T00:00:00.000Z
  const base = new Date('2024-01-01T00:00:00.000Z').getTime();
  const ts = (minutes: number) => new Date(base + minutes * 60_000).toISOString();

  // Dataset spanning 10 minutes: values at 0m, 2m, 4m, 5m (boundary), 7m, 10m (boundary)
  const timeData: DataSet = [
    { ts: ts(0),  value: 10 },
    { ts: ts(2),  value: 20 },
    { ts: ts(4),  value: 30 },
    { ts: ts(5),  value: 40 }, // exactly on the 5m boundary
    { ts: ts(7),  value: 50 },
    { ts: ts(10), value: 60 }, // exactly on the 10m boundary
  ];

  describe('tumbling windows', () => {
    it('aligns windows to duration boundaries instead of the first record timestamp', () => {
      const offsetData: DataSet = [
        { ts: ts(2), value: 10 },
        { ts: ts(4), value: 20 },
        { ts: ts(5), value: 30 },
      ];
      const result = windowTransform(offsetData, {
        field: 'ts',
        size: '5m',
        type: 'tumbling',
        aggregate: [{ field: 'value', fn: 'count', alias: 'count' }],
      });

      expect(result).toHaveLength(2);
      expect(result[0].windowStart).toBe(ts(0));
      expect(result[0].windowEnd).toBe(ts(5));
      expect(result[0].count).toBe(2);
      expect(result[1].windowStart).toBe(ts(5));
      expect(result[1].count).toBe(1);
    });

    it('splits records into non-overlapping windows', () => {
      const result = windowTransform(timeData, {
        field: 'ts',
        size: '5m',
        type: 'tumbling',
        aggregate: [{ field: 'value', fn: 'count', alias: 'count' }],
      });
      // Window [0m, 5m): 0m, 2m, 4m  -> 3 records
      // Window [5m, 10m): 5m, 7m     -> 2 records
      // Window [10m, 15m): 10m        -> 1 record
      expect(result).toHaveLength(3);
      expect(result[0].count).toBe(3);
      expect(result[1].count).toBe(2);
      expect(result[2].count).toBe(1);
    });

    it('records exactly on the window boundary go to the next window', () => {
      const result = windowTransform(timeData, {
        field: 'ts',
        size: '5m',
        type: 'tumbling',
        aggregate: [{ field: 'value', fn: 'sum', alias: 'total' }],
      });
      // Window [0m, 5m): 10+20+30 = 60  (record at 5m is excluded)
      expect(result[0].total).toBe(60);
      // Window [5m, 10m): 40+50 = 90  (record at 10m is excluded)
      expect(result[1].total).toBe(90);
      // Window [10m, 15m): 60
      expect(result[2].total).toBe(60);
    });

    it('sets correct windowStart and windowEnd ISO strings', () => {
      const result = windowTransform(timeData, {
        field: 'ts',
        size: '5m',
        type: 'tumbling',
        aggregate: [{ field: 'value', fn: 'count' }],
      });
      expect(result[0].windowStart).toBe(ts(0));
      expect(result[0].windowEnd).toBe(ts(5));
      expect(result[1].windowStart).toBe(ts(5));
      expect(result[1].windowEnd).toBe(ts(10));
    });

    it('defaults to tumbling when type is omitted', () => {
      const result = windowTransform(timeData, {
        field: 'ts',
        size: '5m',
        aggregate: [{ field: 'value', fn: 'count', alias: 'count' }],
      });
      expect(result).toHaveLength(3);
    });

    it('supports aggregation functions: sum, avg, min, max, count', () => {
      const result = windowTransform(timeData, {
        field: 'ts',
        size: '10m',
        type: 'tumbling',
        aggregate: [
          { field: 'value', fn: 'sum',   alias: 'total' },
          { field: 'value', fn: 'avg',   alias: 'mean' },
          { field: 'value', fn: 'min',   alias: 'lo' },
          { field: 'value', fn: 'max',   alias: 'hi' },
          { field: 'value', fn: 'count', alias: 'n' },
        ],
      });
      // Window [0m, 10m): 10,20,30,40,50  (record at 10m excluded)
      expect(result[0].total).toBe(150);
      expect(result[0].mean).toBe(30);
      expect(result[0].lo).toBe(10);
      expect(result[0].hi).toBe(50);
      expect(result[0].n).toBe(5);
    });

    it('uses default alias fn_field when alias is omitted', () => {
      const result = windowTransform(timeData, {
        field: 'ts',
        size: '10m',
        type: 'tumbling',
        aggregate: [{ field: 'value', fn: 'sum' }],
      });
      expect(result[0]).toHaveProperty('sum_value');
    });

    it('handles single-record windows', () => {
      const single: DataSet = [{ ts: ts(0), value: 42 }];
      const result = windowTransform(single, {
        field: 'ts',
        size: '5m',
        type: 'tumbling',
        aggregate: [{ field: 'value', fn: 'sum', alias: 'total' }],
      });
      expect(result).toHaveLength(1);
      expect(result[0].total).toBe(42);
    });

    it('handles all records falling in the same window', () => {
      const closeData: DataSet = [
        { ts: ts(0), value: 1 },
        { ts: ts(1), value: 2 },
        { ts: ts(2), value: 3 },
      ];
      const result = windowTransform(closeData, {
        field: 'ts',
        size: '1h',
        type: 'tumbling',
        aggregate: [{ field: 'value', fn: 'count', alias: 'count' }],
      });
      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(3);
    });

    it('supports numeric (ms epoch) timestamps', () => {
      const numericData: DataSet = [
        { ts: base,               value: 1 },
        { ts: base + 60_000,      value: 2 },
        { ts: base + 300_000,     value: 3 }, // +5m
      ];
      const result = windowTransform(numericData, {
        field: 'ts',
        size: '5m',
        type: 'tumbling',
        aggregate: [{ field: 'value', fn: 'count', alias: 'count' }],
      });
      expect(result).toHaveLength(2);
      expect(result[0].count).toBe(2);
      expect(result[1].count).toBe(1);
    });

    it('supports duration units: s, h, d', () => {
      const secData: DataSet = [
        { ts: base,           value: 1 },
        { ts: base + 29_000,  value: 2 }, // +29s
        { ts: base + 30_000,  value: 3 }, // +30s (boundary)
      ];
      const result = windowTransform(secData, {
        field: 'ts',
        size: '30s',
        type: 'tumbling',
        aggregate: [{ field: 'value', fn: 'count', alias: 'count' }],
      });
      expect(result[0].count).toBe(2); // [0s, 30s): values at 0s and 29s
      expect(result[1].count).toBe(1); // [30s, 60s): value at 30s
    });
  });

  describe('sliding windows', () => {
    it('produces overlapping windows', () => {
      const result = windowTransform(timeData, {
        field: 'ts',
        size: '10m',
        type: 'sliding',
        step: '5m',
        aggregate: [{ field: 'value', fn: 'count', alias: 'count' }],
      });
      // Window [0m, 10m): 0,2,4,5,7     -> 5 records
      // Window [5m, 15m): 5,7,10         -> 3 records
      // Window [10m, 20m): 10             -> 1 record
      expect(result).toHaveLength(3);
      expect(result[0].count).toBe(5);
      expect(result[1].count).toBe(3);
      expect(result[2].count).toBe(1);
    });

    it('defaults step to size when step is omitted (acts like tumbling)', () => {
      const sliding = windowTransform(timeData, {
        field: 'ts',
        size: '5m',
        type: 'sliding',
        aggregate: [{ field: 'value', fn: 'count', alias: 'count' }],
      });
      const tumbling = windowTransform(timeData, {
        field: 'ts',
        size: '5m',
        type: 'tumbling',
        aggregate: [{ field: 'value', fn: 'count', alias: 'count' }],
      });
      expect(sliding).toEqual(tumbling);
    });

    it('sums values correctly across overlapping windows', () => {
      const result = windowTransform(timeData, {
        field: 'ts',
        size: '10m',
        type: 'sliding',
        step: '5m',
        aggregate: [{ field: 'value', fn: 'sum', alias: 'total' }],
      });
      // Window [0m, 10m): 10+20+30+40+50 = 150
      expect(result[0].total).toBe(150);
      // Window [5m, 15m): 40+50+60 = 150
      expect(result[1].total).toBe(150);
      // Window [10m, 20m): 60
      expect(result[2].total).toBe(60);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty input', () => {
      const result = windowTransform([], {
        field: 'ts',
        size: '5m',
        type: 'tumbling',
        aggregate: [{ field: 'value', fn: 'sum' }],
      });
      expect(result).toEqual([]);
    });

    it('skips records with null or missing timestamps', () => {
      const mixedData: DataSet = [
        { ts: ts(0),   value: 10 },
        { ts: null,    value: 20 },
        { ts: 'bad',   value: 30 },
        { value: 40 },             // ts field absent
        { ts: ts(2),   value: 50 },
      ];
      const result = windowTransform(mixedData, {
        field: 'ts',
        size: '5m',
        type: 'tumbling',
        aggregate: [{ field: 'value', fn: 'count', alias: 'count' }],
      });
      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(2); // only the two valid records
    });

    it('returns empty array when all timestamps are invalid', () => {
      const badData: DataSet = [
        { ts: null, value: 1 },
        { ts: 'not-a-date', value: 2 },
      ];
      const result = windowTransform(badData, {
        field: 'ts',
        size: '5m',
        type: 'tumbling',
        aggregate: [{ field: 'value', fn: 'sum' }],
      });
      expect(result).toEqual([]);
    });

    it('does not emit empty windows', () => {
      // Two records 20 minutes apart with a 5-minute window -> gap in the middle
      const sparseData: DataSet = [
        { ts: ts(0),  value: 1 },
        { ts: ts(20), value: 2 },
      ];
      const result = windowTransform(sparseData, {
        field: 'ts',
        size: '5m',
        type: 'tumbling',
        aggregate: [{ field: 'value', fn: 'count', alias: 'count' }],
      });
      // Only 2 non-empty windows; 3 empty windows in the middle are omitted
      expect(result).toHaveLength(2);
      expect(result[0].count).toBe(1);
      expect(result[1].count).toBe(1);
    });

    it('throws on invalid duration string', () => {
      expect(() =>
        windowTransform(timeData, {
          field: 'ts',
          size: 'five-minutes',
          type: 'tumbling',
          aggregate: [{ field: 'value', fn: 'sum' }],
        })
      ).toThrow('Invalid window duration');
    });

    it('throws on zero duration to avoid non-terminating window iteration', () => {
      expect(() =>
        windowTransform(timeData, {
          field: 'ts',
          size: '0m',
          type: 'tumbling',
          aggregate: [{ field: 'value', fn: 'sum' }],
        })
      ).toThrow('Invalid window duration');
    });

    it('throws on invalid step string', () => {
      expect(() =>
        windowTransform(timeData, {
          field: 'ts',
          size: '10m',
          type: 'sliding',
          step: 'bad',
          aggregate: [{ field: 'value', fn: 'sum' }],
        })
      ).toThrow('Invalid window duration');
    });
  });
});
