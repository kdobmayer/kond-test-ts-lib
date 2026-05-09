import { map, filter, select, rename, aggregate, join, sort, deduplicate } from './index';
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
