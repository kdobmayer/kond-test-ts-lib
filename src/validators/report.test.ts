import { ValidationReport } from './report';
import { ValidationIssue, ValidationResult } from '../types';

describe('ValidationReport', () => {
  const errorIssue: ValidationIssue = { field: 'name', message: 'Required', severity: 'error', row: 0 };
  const warningIssue: ValidationIssue = { field: 'age', message: 'Too young', severity: 'warning', row: 1 };
  const infoIssue: ValidationIssue = { field: 'name', message: 'Suggestion', severity: 'info', row: 2 };

  const validResult: ValidationResult = { valid: true, issues: [warningIssue] };
  const invalidResult: ValidationResult = { valid: false, issues: [errorIssue, infoIssue] };

  describe('empty state', () => {
    it('returns all-zero summary with valid: true', () => {
      const report = new ValidationReport();
      expect(report.getSummary()).toEqual({
        totalResults: 0,
        totalIssues: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        valid: true,
      });
    });

    it('getFailures returns empty array', () => {
      expect(new ValidationReport().getFailures()).toEqual([]);
    });

    it('getIssuesByField returns empty array', () => {
      expect(new ValidationReport().getIssuesByField('name')).toEqual([]);
    });

    it('getIssuesBySeverity returns empty array', () => {
      expect(new ValidationReport().getIssuesBySeverity('error')).toEqual([]);
    });
  });

  describe('addResult', () => {
    it('accumulates results and their issues', () => {
      const report = new ValidationReport();
      report.addResult(validResult);
      report.addResult(invalidResult);

      const summary = report.getSummary();
      expect(summary.totalResults).toBe(2);
      expect(summary.totalIssues).toBe(3);
      expect(summary.errorCount).toBe(1);
      expect(summary.warningCount).toBe(1);
      expect(summary.infoCount).toBe(1);
      expect(summary.valid).toBe(false);
    });

    it('valid is true when only warnings/info present', () => {
      const report = new ValidationReport();
      report.addResult(validResult);
      expect(report.getSummary().valid).toBe(true);
    });

    it('clones input so post-insert mutation does not affect report', () => {
      const mutableResult: ValidationResult = {
        valid: false,
        issues: [{ field: 'x', message: 'bad', severity: 'error' }],
      };
      const report = new ValidationReport();
      report.addResult(mutableResult);

      mutableResult.issues[0].severity = 'info';
      mutableResult.issues.push({ field: 'y', message: 'extra', severity: 'error' });

      const summary = report.getSummary();
      expect(summary.errorCount).toBe(1);
      expect(summary.infoCount).toBe(0);
      expect(summary.totalIssues).toBe(1);
    });
  });

  describe('addIssue', () => {
    it('appends a single issue directly', () => {
      const report = new ValidationReport();
      report.addIssue(errorIssue);

      const summary = report.getSummary();
      expect(summary.totalResults).toBe(0);
      expect(summary.totalIssues).toBe(1);
      expect(summary.errorCount).toBe(1);
      expect(summary.valid).toBe(false);
    });

    it('clones input so post-insert mutation does not affect report', () => {
      const mutableIssue: ValidationIssue = { field: 'z', message: 'oops', severity: 'error' };
      const report = new ValidationReport();
      report.addIssue(mutableIssue);

      mutableIssue.severity = 'info';

      expect(report.getSummary().errorCount).toBe(1);
      expect(report.getSummary().infoCount).toBe(0);
    });

    it('standalone error issue appears in getFailures', () => {
      const report = new ValidationReport();
      report.addIssue({ field: 'f', message: 'err', severity: 'error' });

      const failures = report.getFailures();
      expect(failures).toHaveLength(1);
      expect(failures[0].valid).toBe(false);
      expect(failures[0].issues[0].field).toBe('f');
    });

    it('standalone warning issue does not appear in getFailures', () => {
      const report = new ValidationReport();
      report.addIssue({ field: 'f', message: 'warn', severity: 'warning' });

      expect(report.getFailures()).toHaveLength(0);
    });
  });

  describe('getIssuesByField', () => {
    it('returns only issues matching the given field', () => {
      const report = new ValidationReport();
      report.addResult(validResult);
      report.addResult(invalidResult);

      const nameIssues = report.getIssuesByField('name');
      expect(nameIssues).toHaveLength(2);
      expect(nameIssues.every(i => i.field === 'name')).toBe(true);

      const ageIssues = report.getIssuesByField('age');
      expect(ageIssues).toHaveLength(1);
      expect(ageIssues[0].field).toBe('age');
    });

    it('includes standalone issues added via addIssue', () => {
      const report = new ValidationReport();
      report.addIssue({ field: 'name', message: 'standalone', severity: 'warning' });

      expect(report.getIssuesByField('name')).toHaveLength(1);
    });

    it('returns empty array for unknown field', () => {
      const report = new ValidationReport();
      report.addResult(invalidResult);
      expect(report.getIssuesByField('unknown')).toEqual([]);
    });
  });

  describe('getIssuesBySeverity', () => {
    it('returns only error issues', () => {
      const report = new ValidationReport();
      report.addResult(validResult);
      report.addResult(invalidResult);

      const errors = report.getIssuesBySeverity('error');
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('error');
    });

    it('returns only warning issues', () => {
      const report = new ValidationReport();
      report.addResult(validResult);
      report.addResult(invalidResult);

      const warnings = report.getIssuesBySeverity('warning');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe('warning');
    });

    it('returns only info issues', () => {
      const report = new ValidationReport();
      report.addResult(validResult);
      report.addResult(invalidResult);

      const infos = report.getIssuesBySeverity('info');
      expect(infos).toHaveLength(1);
      expect(infos[0].severity).toBe('info');
    });

    it('includes standalone issues from addIssue', () => {
      const report = new ValidationReport();
      report.addIssue({ field: 'f', message: 'w', severity: 'warning' });

      expect(report.getIssuesBySeverity('warning')).toHaveLength(1);
    });
  });

  describe('getFailures', () => {
    it('returns only results with at least one error', () => {
      const report = new ValidationReport();
      report.addResult(validResult);
      report.addResult(invalidResult);

      const failures = report.getFailures();
      expect(failures).toHaveLength(1);
      expect(failures[0].valid).toBe(false);
      expect(failures[0].issues.some(i => i.severity === 'error')).toBe(true);
    });

    it('returns empty array when no errors present', () => {
      const report = new ValidationReport();
      report.addResult(validResult);
      expect(report.getFailures()).toHaveLength(0);
    });

    it('deep-clones issue objects so mutating a returned issue does not corrupt state', () => {
      const report = new ValidationReport();
      report.addResult(invalidResult);

      const failures = report.getFailures();
      failures[0].issues[0].severity = 'info';

      expect(report.getSummary().errorCount).toBe(1);
    });
  });

  describe('immutability', () => {
    it('mutation of getIssuesByField result does not affect internal state', () => {
      const report = new ValidationReport();
      report.addResult(invalidResult);

      const result = report.getIssuesByField('name');
      result.push({ field: 'extra', message: 'injected', severity: 'error' });

      expect(report.getSummary().totalIssues).toBe(2);
    });

    it('mutation of getIssuesBySeverity result does not affect internal state', () => {
      const report = new ValidationReport();
      report.addResult(invalidResult);

      const result = report.getIssuesBySeverity('error');
      result.push({ field: 'extra', message: 'injected', severity: 'error' });

      expect(report.getSummary().errorCount).toBe(1);
    });

    it('mutation of getFailures result does not affect internal state', () => {
      const report = new ValidationReport();
      report.addResult(invalidResult);

      const failures = report.getFailures();
      failures.push({ valid: false, issues: [] });

      expect(report.getSummary().totalResults).toBe(1);
    });
  });
});
