// Structured single-line JSON logging. Never logs message text, PII, or secrets.
export function createLogger(context = {}) {
  return {
    log(event, fields = {}) {
      process.stdout.write(
        JSON.stringify({
          ts: new Date().toISOString(),
          ...context,
          event,
          ...fields,
        }) + "\n",
      );
    },
  };
}
