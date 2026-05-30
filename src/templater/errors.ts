export class TemplateVarsValidationError extends Error {
  readonly fields: string[];

  constructor(message: string, fields: string[] = []) {
    super(message);
    this.name = "TemplateVarsValidationError";
    this.fields = fields;
  }
}
