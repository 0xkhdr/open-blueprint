import { Command } from "commander";
import {
  detectTelemetryPlatform,
  getTelemetryInitConfig,
} from "../../observability/telemetry-detect.js";
import { BpError } from "../../errors.js";

export function createTelemetryCommand(): Command {
  const cmd = new Command("telemetry").description("Telemetry configuration commands");

  cmd
    .command("detect")
    .description("Auto-detect telemetry platform from project dependencies")
    .option("--json", "Output as JSON")
    .argument("[project-root]", "Project root directory", process.cwd())
    .action((projectRoot: string, opts: { json?: boolean }) => {
      const platform = detectTelemetryPlatform(projectRoot);
      if (opts.json) {
        console.log(JSON.stringify({ platform: platform ?? null }));
        return;
      }
      if (platform) {
        console.log(`Detected telemetry platform: ${platform}`);
      } else {
        console.log("No telemetry platform detected.");
        console.log("Supported: opentelemetry, datadog, newrelic, prometheus, cloudwatch");
      }
    });

  cmd
    .command("init")
    .description("Generate telemetry config snippet for detected or specified platform")
    .option("--platform <platform>", "Override platform detection")
    .option("--json", "Output as JSON")
    .argument("[project-root]", "Project root directory", process.cwd())
    .action((projectRoot: string, opts: { platform?: string; json?: boolean }) => {
      const platform =
        (opts.platform as Parameters<typeof getTelemetryInitConfig>[0] | undefined) ??
        detectTelemetryPlatform(projectRoot);

      if (!platform) {
        console.error("No telemetry platform detected. Use --platform to specify one.");
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }

      const config = getTelemetryInitConfig(
        platform as Parameters<typeof getTelemetryInitConfig>[0]
      );

      if (opts.json) {
        console.log(JSON.stringify({ platform, config }));
        return;
      }

      console.log(`# Telemetry config for ${platform}\n`);
      console.log(config);
    });

  return cmd;
}
