export class BpError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly code: string,
    public readonly resolution: string
  ) {
    super(message);
    this.name = "BpError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DetectionError extends BpError {
  constructor(message: string, resolution = "See: docs/troubleshooting.md#code-1") {
    super(message, 1, "DETECTION_ERROR", resolution);
    this.name = "DetectionError";
  }
}

export class ConfigError extends BpError {
  constructor(message: string, resolution = "See: docs/troubleshooting.md#code-3") {
    super(message, 3, "CONFIG_ERROR", resolution);
    this.name = "ConfigError";
  }
}

export class TemplateError extends BpError {
  constructor(message: string, resolution = "See: docs/troubleshooting.md#code-3") {
    super(message, 3, "TEMPLATE_ERROR", resolution);
    this.name = "TemplateError";
  }
}

export class ValidationError extends BpError {
  constructor(
    message: string,
    exitCode: 4 | 5 = 4,
    resolution = `See: docs/troubleshooting.md#code-${exitCode}`
  ) {
    super(message, exitCode, "VALIDATION_ERROR", resolution);
    this.name = "ValidationError";
  }
}

export class DriftError extends BpError {
  constructor(message: string, resolution = "See: docs/troubleshooting.md#code-6") {
    super(message, 6, "DRIFT_DETECTED", resolution);
    this.name = "DriftError";
  }
}

export class TranslationError extends BpError {
  constructor(message: string, resolution = "See: docs/troubleshooting.md#code-7") {
    super(message, 7, "TRANSLATION_ERROR", resolution);
    this.name = "TranslationError";
  }
}

export class NetworkError extends BpError {
  constructor(
    message: string,
    public readonly attemptCount: number = 0,
    public readonly lastStatusCode?: number,
    resolution = "See: docs/troubleshooting.md#code-8"
  ) {
    super(message, 8, "NETWORK_ERROR", resolution);
    this.name = "NetworkError";
  }
}

export class PermissionError extends BpError {
  constructor(message: string, resolution = "See: docs/troubleshooting.md#code-9") {
    super(message, 9, "PERMISSION_ERROR", resolution);
    this.name = "PermissionError";
  }
}

export class HealthError extends BpError {
  constructor(message: string, resolution = "See: docs/troubleshooting.md#code-10") {
    super(message, 10, "HEALTH_ERROR", resolution);
    this.name = "HealthError";
  }
}

export class SecurityError extends BpError {
  constructor(message: string, resolution = "See: docs/troubleshooting.md#security") {
    super(message, 8, "SECURITY_ERROR", resolution);
    this.name = "SecurityError";
  }
}

export class InputValidationError extends BpError {
  constructor(message: string, resolution = "Provide valid input within allowed constraints") {
    super(message, 1, "INPUT_VALIDATION_ERROR", resolution);
    this.name = "InputValidationError";
  }
}

export class PluginLoadError extends BpError {
  constructor(message: string, resolution = "Ensure plugin file exists and exports valid code") {
    super(message, 3, "PLUGIN_LOAD_ERROR", resolution);
    this.name = "PluginLoadError";
  }
}

export class PluginTimeoutError extends BpError {
  constructor(message: string, resolution = "Reduce plugin complexity or increase BP_VALIDATION_TIMEOUT_MS") {
    super(message, 3, "PLUGIN_TIMEOUT_ERROR", resolution);
    this.name = "PluginTimeoutError";
  }
}
