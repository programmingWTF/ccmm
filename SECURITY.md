# Security Policy

## Reporting

If you discover a security issue, **do not open a public issue**. Email the repository owner directly. You should receive a response within 72 hours.

## Scope

ccmm is a local CLI tool and proxy. Key considerations:

- **API keys** — read from env vars or stored in local `~/.ccmm/config.json`; sent only to configured upstream providers.
- **Proxy binding** — defaults to `127.0.0.1` (localhost only). Changing to `0.0.0.0` would expose it to the network.
- **Dependencies** — minimal runtime deps: `commander`, `zod`, `picocolors`, `@inquirer/prompts`.

## Best practices for users

- Keep `proxy.host` as `127.0.0.1`.
- Use `apiKeyEnv` to reference env vars instead of inline keys.
- Run `npm audit` periodically.
