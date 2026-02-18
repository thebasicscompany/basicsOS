---
paths: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
---
# Security Rules

- NEVER hardcode secrets, API keys, or credentials in source code
- NEVER commit .env files — use .env.example with placeholder values
- Validate and sanitize all user input at system boundaries
- Use parameterized queries — never concatenate SQL strings
- Escape HTML output to prevent XSS
- Set appropriate CORS headers — never use `*` in production
- Use HTTPS for all external API calls
- Apply principle of least privilege for file system and network access
- Log security-relevant events but never log sensitive data (passwords, tokens)
