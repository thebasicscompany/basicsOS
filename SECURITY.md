# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Basics OS, please report it responsibly.

**Do NOT** create a public GitHub issue for security vulnerabilities.

### How to Report

1. **Email**: Send details to security@basicsos.com (or your security contact)
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We'll acknowledge receipt within 48 hours
- **Assessment**: We'll assess the vulnerability within 7 days
- **Update**: We'll provide updates on our progress
- **Fix**: We'll work to release a patch as soon as possible
- **Disclosure**: We'll coordinate disclosure after a fix is available

### Security Best Practices

When self-hosting Basics OS:

1. **Keep dependencies updated**: Run `pnpm audit` regularly
2. **Use strong secrets**: Generate `BETTER_AUTH_SECRET` with `openssl rand -hex 32`
3. **Enable HTTPS**: Use a reverse proxy (Caddy) for production
4. **Database security**: Use strong PostgreSQL passwords, enable SSL
5. **Network security**: Restrict database/Redis access to internal networks
6. **Regular backups**: Backup your PostgreSQL database regularly
7. **Monitor logs**: Review error logs for suspicious activity

### Known Security Features

Basics OS includes:

- ✅ **Multi-tenant isolation**: Row-Level Security (RLS) at database level
- ✅ **RBAC**: Role-based access control (admin/member/viewer)
- ✅ **Input validation**: All inputs validated with Zod schemas
- ✅ **PII redaction**: Sensitive data redacted in logs
- ✅ **Rate limiting**: API rate limits to prevent abuse
- ✅ **Secure sessions**: Better Auth handles secure session management
- ✅ **Password hashing**: bcrypt for password storage

### Security Audit

We run automated security audits in CI:

- Dependency vulnerability scanning (`pnpm audit`)
- Input validation tests
- RBAC enforcement tests
- Multi-tenant isolation tests
- Secrets scanning

### Responsible Disclosure

We follow responsible disclosure practices:

1. **Private reporting**: Report vulnerabilities privately first
2. **Timely fixes**: We prioritize security fixes
3. **Coordinated disclosure**: We'll coordinate public disclosure after a fix is available
4. **Credit**: We'll credit security researchers (if desired)

Thank you for helping keep Basics OS secure!

