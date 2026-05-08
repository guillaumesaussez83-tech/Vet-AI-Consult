/**
 * Phase 0F — Environment variables validation
 *
 * Run at server startup (before Express listens).
 * Throws immediately if any required variable is missing or malformed.
 *
 * Usage in app.ts (first line before any import):
 *   import { validateEnv } from "./middleware/validateEnv";
 *   validateEnv();
 */

interface EnvSpec {
  key: string;
  required: boolean;
  description: string;
  validate?: (val: string) => boolean;
  hint?: string;
}

const ENV_SPECS: EnvSpec[] = [
  {
    key: "DATABASE_URL",
    required: true,
    description: "PostgreSQL connection string",
    validate: (v) => v.startsWith("postgresql://") || v.startsWith("postgres://"),
    hint: "Must start with postgresql:// or postgres://",
  },
  {
    key: "CLERK_SECRET_KEY",
    required: true,
    description: "Clerk secret key",
    validate: (v) => v.startsWith("sk_"),
    hint: "Must start with sk_",
  },
  {
    key: "OPENAI_API_KEY",
    required: true,
    description: "OpenAI API key",
    validate: (v) => v.startsWith("sk-"),
    hint: "Must start with sk-",
  },
  {
    key: "FRONTEND_URL",
    required: true,
    description: "Frontend URL for CORS",
    validate: (v) => v.startsWith("http") && !v.endsWith("/"),
    hint: "Must start with http(s):// and must NOT end with /",
  },
  {
    key: "NODE_ENV",
    required: false,
    description: "Node environment",
    validate: (v) => ["production", "development", "test"].includes(v),
    hint: "Must be one of: production, development, test",
  },
  // Twilio: optional but validated if present
  {
    key: "TWILIO_ACCOUNT_SID",
    required: false,
    description: "Twilio Account SID",
    validate: (v) => v.startsWith("AC"),
    hint: "Must start with AC",
  },
  {
    key: "TWILIO_AUTH_TOKEN",
    required: false,
    validate: (v: string) => v.length >= 32,
    hint: "TWILIO_AUTH_TOKEN must be at least 32 characters",
  },
  {
    key: "TWILIO_FROM",
    required: false,
    validate: (v: string) => v.startsWith("+"),
    hint: "TWILIO_FROM must be an E.164 phone number starting with +",
  },
  {
    key: "AI_TIMEOUT_MS",
    required: false,
    validate: (v: string) => !isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0,
    hint: "AI_TIMEOUT_MS must be a positive integer (milliseconds)",
  },
];


// Cross-validation: if any Twilio var is set, all three must be set
const twilioSid = process.env["TWILIO_ACCOUNT_SID"];
const twilioToken = process.env["TWILIO_AUTH_TOKEN"];
const twilioFrom = process.env["TWILIO_FROM"];
if (twilioSid || twilioToken || twilioFrom) {
  if (!twilioSid || !twilioToken || !twilioFrom) {
    const missing = [
      !twilioSid && "TWILIO_ACCOUNT_SID",
      !twilioToken && "TWILIO_AUTH_TOKEN",
      !twilioFrom && "TWILIO_FROM",
    ].filter(Boolean).join(", ");
    console.error(`[validateEnv] Twilio partial config detected. Missing: ${missing}. All three must be set together.`);
    process.exit(1);
  }
}

export function validateEnv(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const spec of ENV_SPECS) {
    const val = process.env[spec.key];

    if (!val) {
      if (spec.required) {
        errors.push(`  ❌ ${spec.key}: MISSING — ${spec.description}`);
      } else {
        warnings.push(`  ⚠️  ${spec.key}: not set (${spec.description})`);
      }
      continue;
    }

    if (spec.validate && !spec.validate(val)) {
      const msg = `  ❌ ${spec.key}: INVALID — ${spec.hint ?? spec.description}`;
      if (spec.required) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    }
  }

  if (warnings.length > 0) {
    console.warn("\n[env] Optional variables not set:");
    warnings.forEach((w) => console.warn(w));
  }

  if (errors.length > 0) {
    console.error("\n[env] FATAL — Required environment variables are missing or invalid:"),
    errors.forEach((e) => console.error(e));
    console.error(
      "\n  → Copy .env.example to .env and fill in all required values.\n"
    );
    process.exit(1);
  }

  console.log(`[env] ✅ All required environment variables are valid (NODE_ENV=${process.env.NODE_ENV ?? "development"})`);
}
