import { ValidationIssue, ValidationResult, ValidationSeverity } from '../types';

function cloneIssue(issue: ValidationIssue): ValidationIssue {
  return { ...issue };
}

export class ValidationReport {
  private _results: ValidationResult[] = [];
  private _standaloneIssues: ValidationIssue[] = [];

  private get _allIssues(): ValidationIssue[] {
    return [...this._results.flatMap(r => r.issues), ...this._standaloneIssues];
  }

  addResult(result: ValidationResult): void {
    this._results.push({ valid: result.valid, issues: result.issues.map(cloneIssue) });
  }

  addIssue(issue: ValidationIssue): void {
    this._standaloneIssues.push(cloneIssue(issue));
  }

  getSummary(): {
    totalResults: number;
    totalIssues: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    valid: boolean;
  } {
    const all = this._allIssues;
    const errorCount = all.filter(i => i.severity === 'error').length;
    return {
      totalResults: this._results.length,
      totalIssues: all.length,
      errorCount,
      warningCount: all.filter(i => i.severity === 'warning').length,
      infoCount: all.filter(i => i.severity === 'info').length,
      valid: errorCount === 0,
    };
  }

  getFailures(): ValidationResult[] {
    const failures: ValidationResult[] = this._results
      .filter(r => r.issues.some(i => i.severity === 'error'))
      .map(r => ({ valid: false, issues: r.issues.map(cloneIssue) }));

    const standaloneErrors = this._standaloneIssues.filter(i => i.severity === 'error');
    if (standaloneErrors.length > 0) {
      failures.push({ valid: false, issues: standaloneErrors.map(cloneIssue) });
    }

    return failures;
  }

  getIssuesByField(field: string): ValidationIssue[] {
    return this._allIssues.filter(i => i.field === field).map(cloneIssue);
  }

  getIssuesBySeverity(severity: ValidationSeverity): ValidationIssue[] {
    return this._allIssues.filter(i => i.severity === severity).map(cloneIssue);
  }

  getAllIssues(): ValidationIssue[] {
    return this._allIssues.map(cloneIssue);
  }

  clone(): ValidationReport {
    const copy = new ValidationReport();
    for (const r of this._results) {
      copy.addResult(r);
    }
    for (const i of this._standaloneIssues) {
      copy.addIssue(i);
    }
    return copy;
  }
}
