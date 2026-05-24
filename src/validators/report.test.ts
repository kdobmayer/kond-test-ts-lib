import { ValidationReport } from './report';
import { ValidationIssue, ValidationResult } from '../types';

function makeResult(issues: ValidationIssue[]): ValidationResult {
  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  };
}

describe('ValidationReport', () => {
  it('starts empty', () => {
    const report = new ValidationReport();
    const summary = report.getSummary();
    expect(summary.totalIssues).toBe(0);
    expect(summary.passCount).toBe(0);
    expect(summary.failCount).toBe(0);
    expect(summary.bySeverity).toEqual({ error: 0, warning: 0, info: 0 });
    expect(summary.byField).toEqual({});
    expect(summary.byRow).toEqual({});
    expect(report.getFailures()).toEqual([]);
  });

  it('accumulates issues from a single addResult', () => {
    const report = new ValidationReport();
    report.addResult(makeResult([
      { field: 'name', message: 'required', severity: 'error', row: 0 },
      { field: 'age', message: 'out of range', severity: 'error', row: 0 },
      { field: 'email', message: 'invalid format', severity: 'warning', row: 1 },
    ]));

    const summary = report.getSummary();
    expect(summary.totalIssues).toBe(3);
    expect(summary.bySeverity.error).toBe(2);
    expect(summary.bySeverity.warning).toBe(1);
    expect(summary.bySeverity.info).toBe(0);
    expect(summary.byRow[0]).toBe(2);
    expect(summary.byRow[1]).toBe(1);
    expect(summary.byField['name']).toBe(1);
    expect(summary.byField['age']).toBe(1);
    expect(summary.byField['email']).toBe(1);
  });

  it('accumulates across multiple addResult calls', () => {
    const report = new ValidationReport();
    report.addResult(makeResult([
      { field: 'name', message: 'required', severity: 'error', row: 0 },
    ]));
    report.addResult(makeResult([
      { field: 'age', message: 'invalid', severity: 'warning', row: 2 },
    ]), 'schema-check');

    const summary = report.getSummary();
    expect(summary.totalIssues).toBe(2);
    expect(summary.bySeverity.error).toBe(1);
    expect(summary.bySeverity.warning).toBe(1);
  });

  it('getFailures() returns only error-severity issues by default', () => {
    const report = new ValidationReport();
    report.addResult(makeResult([
      { field: 'x', message: 'err', severity: 'error', row: 0 },
      { field: 'y', message: 'warn', severity: 'warning', row: 0 },
      { field: 'z', message: 'info', severity: 'info', row: 0 },
    ]));

    const failures = report.getFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0].severity).toBe('error');
    expect(failures[0].field).toBe('x');
  });

  it('getFailures(severity) filters by the given severity', () => {
    const report = new ValidationReport();
    report.addResult(makeResult([
      { field: 'x', message: 'err', severity: 'error', row: 0 },
      { field: 'y', message: 'warn', severity: 'warning', row: 1 },
      { field: 'z', message: 'info-msg', severity: 'info', row: 2 },
    ]));

    expect(report.getFailures('warning')).toHaveLength(1);
    expect(report.getFailures('warning')[0].field).toBe('y');
    expect(report.getFailures('info')).toHaveLength(1);
    expect(report.getFailures('info')[0].field).toBe('z');
    expect(report.getFailures('error')).toHaveLength(1);
  });

  it('getSummary() computes passCount and failCount correctly', () => {
    const report = new ValidationReport();
    // row 0 has an error → fail; row 1 has only a warning → pass
    report.addResult(makeResult([
      { field: 'a', message: 'err', severity: 'error', row: 0 },
      { field: 'b', message: 'warn', severity: 'warning', row: 1 },
    ]));

    const summary = report.getSummary();
    expect(summary.failCount).toBe(1);
    expect(summary.passCount).toBe(1);
  });

  it('counts clean rows when totalRows is provided', () => {
    const report = new ValidationReport();
    report.addResult(makeResult([
      { field: 'a', message: 'err', severity: 'error', row: 0 },
    ]), { totalRows: 3 });

    const summary = report.getSummary();
    expect(summary.failCount).toBe(1);
    expect(summary.passCount).toBe(2);
  });

  it('does not double-count totalRows across multiple results for the same source', () => {
    const report = new ValidationReport();
    report.addResult(makeResult([
      { field: 'a', message: 'err', severity: 'error', row: 0 },
    ]), { source: 'schema', totalRows: 3 });
    report.addResult(makeResult([
      { field: 'b', message: 'warn', severity: 'warning', row: 1 },
    ]), { source: 'schema', totalRows: 3 });

    const summary = report.getSummary();
    expect(summary.failCount).toBe(1);
    expect(summary.passCount).toBe(2);
  });

  it('issues with no row do not affect passCount/failCount', () => {
    const report = new ValidationReport();
    report.addResult(makeResult([
      { field: 'global', message: 'dataset error', severity: 'error' },
    ]));

    const summary = report.getSummary();
    expect(summary.totalIssues).toBe(1);
    expect(summary.bySeverity.error).toBe(1);
    expect(summary.byRow).toEqual({});
    expect(summary.passCount).toBe(0);
    expect(summary.failCount).toBe(0);
  });

  it('clear() resets to empty state', () => {
    const report = new ValidationReport();
    report.addResult(makeResult([
      { field: 'x', message: 'err', severity: 'error', row: 0 },
    ]));

    report.clear();

    const summary = report.getSummary();
    expect(summary.totalIssues).toBe(0);
    expect(summary.bySeverity).toEqual({ error: 0, warning: 0, info: 0 });
    expect(summary.byField).toEqual({});
    expect(summary.byRow).toEqual({});
    expect(report.getFailures()).toEqual([]);
  });

  it('accumulates counts in byField across rows', () => {
    const report = new ValidationReport();
    report.addResult(makeResult([
      { field: 'name', message: 'err', severity: 'error', row: 0 },
      { field: 'name', message: 'err', severity: 'error', row: 1 },
    ]));

    expect(report.getSummary().byField['name']).toBe(2);
  });

  it('stores issues defensively', () => {
    const report = new ValidationReport();
    const issue: ValidationIssue = { field: 'x', message: 'err', severity: 'error', row: 0 };
    report.addResult(makeResult([issue]));
    issue.message = 'mutated';

    const failures = report.getFailures();
    expect(failures[0].message).toBe('err');

    failures[0].message = 'changed again';
    expect(report.getFailures()[0].message).toBe('err');
  });
});
