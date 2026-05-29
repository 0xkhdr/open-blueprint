import * as fs from "node:fs";
import * as path from "node:path";

export interface EnvVariable {
  key: string;
  description: string;
  required: boolean;
  example?: string;
}

export function generateEnvTemplate(projectRoot: string): string {
  const vars = detectEnvVariables(projectRoot);

  let template = "# Environment Variables Template\n";
  template += "# Copy to .env and fill in values\n";
  template += "# DO NOT commit .env to version control\n\n";

  if (vars.length === 0) {
    template += "# No environment variables detected in source files\n";
    return template;
  }

  for (const v of vars) {
    template += `# ${v.description}\n`;
    if (v.required) {
      template += `${v.key}=\n`;
    } else {
      template += `# ${v.key}=${v.example ?? ""}\n`;
    }
    template += "\n";
  }

  return template;
}

export function detectEnvVariables(root: string): EnvVariable[] {
  const vars: EnvVariable[] = [];
  const files = collectSourceFiles(root);
  const seen = new Set<string>();

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    for (const match of content.matchAll(/process\.env\.(\w+)|process\.env\[["'](\w+)["']\]/g)) {
      const key = match[1] ?? match[2];
      if (key && !seen.has(key)) {
        seen.add(key);
        const hasDefault = content.includes(`${key} ||`) || content.includes(`${key}??`);
        vars.push({
          key,
          description: inferDescription(key),
          required: !hasDefault,
          example: inferExample(key),
        });
      }
    }
  }

  return vars.sort((a, b) => a.key.localeCompare(b.key));
}

export function inferDescription(key: string): string {
  const descriptions: Record<string, string> = {
    PORT: "Server port number",
    HOST: "Server hostname",
    NODE_ENV: "Environment mode (development, production, test)",
    DATABASE_URL: "Database connection string",
    DB_URL: "Database connection string",
    REDIS_URL: "Redis connection string",
    API_KEY: "External API authentication key",
    API_SECRET: "External API secret",
    JWT_SECRET: "Secret key for JWT token signing",
    SECRET_KEY: "Application secret key",
    LOG_LEVEL: "Logging verbosity level",
    OPENAI_API_KEY: "OpenAI API key",
    ANTHROPIC_API_KEY: "Anthropic API key",
    STRIPE_SECRET_KEY: "Stripe secret key",
    AWS_ACCESS_KEY_ID: "AWS access key ID",
    AWS_SECRET_ACCESS_KEY: "AWS secret access key",
    AWS_REGION: "AWS region",
    GITHUB_TOKEN: "GitHub personal access token",
    SLACK_BOT_TOKEN: "Slack bot token",
    SMTP_HOST: "SMTP server hostname",
    SMTP_PORT: "SMTP server port",
    SMTP_USER: "SMTP username",
    SMTP_PASS: "SMTP password",
  };
  return descriptions[key] ?? `Configuration for ${key}`;
}

function inferExample(key: string): string {
  const examples: Record<string, string> = {
    PORT: "3000",
    HOST: "localhost",
    NODE_ENV: "development",
    AWS_REGION: "us-east-1",
    LOG_LEVEL: "info",
    SMTP_PORT: "587",
  };
  return examples[key] ?? "";
}

function collectSourceFiles(root: string): string[] {
  const extensions = new Set([".ts", ".js", ".tsx", ".jsx", ".py", ".rb", ".go", ".java"]);
  const files: string[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", ".git", "dist", ".next", "build", "coverage"].includes(entry.name))
          continue;
        walk(fullPath);
      } else if (extensions.has(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  }

  walk(root);
  return files;
}
