// Collects validation findings. Kept separate so every check module reports
// through the same interface instead of printing directly.
export class Report {
  constructor() {
    this.errors = []
    this.warnings = []
  }

  err(message) {
    this.errors.push(message)
  }

  warn(message) {
    this.warnings.push(message)
  }
}
