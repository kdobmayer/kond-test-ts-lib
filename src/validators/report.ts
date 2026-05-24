import {
  ValidationReportAddOptions,
  ValidationIssue,
  ValidationResult,
  ValidationReportSummary,
  ValidationSeverity,
} from '../types';

interface SourceStats {
  totalRows?: number;
  rowsWithIssues: Set<number>;
  rowsWithErrors: Set<number>;
}

export class ValidationReport {
  private _issues: ValidationIssue[] = [];
  private readonly _sourceStats = new Map<string, SourceStats>();

  addResult(result: ValidationResult, sourceOrOptions?: string | ValidationReportAddOptions): void {
    const options: ValidationReportAddOptions =
      typeof sourceOrOptions === 'string' ? { source: sourceOrOptions } : (sourceOrOptions ?? {});
    const sourceKey = options.source ?? '__default__';
    const sourceStats = this.getSourceStats(sourceKey);

    if (options.totalRows !== undefined) {
      sourceStats.totalRows = Math.max(sourceStats.totalRows ?? 0, options.totalRows);
    }

    for (const issue of result.issues) {
      const issueCopy = { ...issue };
      this._issues.push(issueCopy);

      if (issueCopy.row === undefined) {
        continue;
      }

      sourceStats.rowsWithIssues.add(issueCopy.row);
      if (issueCopy.severity === 'error') {
        sourceStats.rowsWithErrors.add(issueCopy.row);
      }
    }
  }

  getSummary(): ValidationReportSummary {
    const byField: Record<string, number> = {};
    const byRow: Record<number, number> = {};
    const bySeverity: Record<ValidationSeverity, number> = { error: 0, warning: 0, info: 0 };
    let passCount = 0;
    let failCount = 0;

    for (const issue of this._issues) {
      byField[issue.field] = (byField[issue.field] ?? 0) + 1;
      if (issue.row !== undefined) {
        byRow[issue.row] = (byRow[issue.row] ?? 0) + 1;
      }
      bySeverity[issue.severity]++;
    }

    for (const stats of this._sourceStats.values()) {
      failCount += stats.rowsWithErrors.size;

      if (stats.totalRows !== undefined) {
        passCount += Math.max(0, stats.totalRows - stats.rowsWithErrors.size);
        continue;
      }

      passCount += stats.rowsWithIssues.size - stats.rowsWithErrors.size;
    }

    return {
      totalIssues: this._issues.length,
      byField,
      byRow,
      bySeverity,
      passCount,
      failCount,
    };
  }

  getFailures(severity?: ValidationSeverity): ValidationIssue[] {
    const target = severity ?? 'error';
    return this._issues
      .filter(i => i.severity === target)
      .map(issue => ({ ...issue }));
  }

  clear(): void {
    this._issues = [];
    this._sourceStats.clear();
  }

  private getSourceStats(sourceKey: string): SourceStats {
    const existing = this._sourceStats.get(sourceKey);
    if (existing) {
      return existing;
    }

    const created: SourceStats = {
      rowsWithIssues: new Set<number>(),
      rowsWithErrors: new Set<number>(),
    };
    this._sourceStats.set(sourceKey, created);
    return created;
  }
}
