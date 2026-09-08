import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const script = readFileSync(new URL('../../../infrastructure/container/local/Postgres.sh', import.meta.url), 'utf8');

describe('local PostgreSQL credential reconciliation', () => {
  it('reconciles every login role from the current secret files on repeated startup', () => {
    const admin = 'set_role_password "$POSTGRES_USER" "$(read_secret "$POSTGRES_PASSWORD_FILE")"';
    expect(script).toContain('set_role_password "$role" "$password"');
    expect(script).toContain(admin);
    expect(script.indexOf(admin)).toBeLessThan(script.indexOf('create_role shopapp'));
    expect(script).toContain('create_role shopapp "$(read_secret "$SHOPAPP_PASSWORD_FILE")"');
    expect(script).toContain('create_role shopjob "$(read_secret "$SHOPJOB_PASSWORD_FILE")"');
    expect(script).toContain('create_role shopprovider "$(read_secret "$SHOPPROVIDER_PASSWORD_FILE")"');
  });

  it('passes role names and passwords through psql identifier and environment-backed literal variables', () => {
    expect(script).toContain('--set=role="$role"');
    expect(script).toContain("'\\getenv password ROLE_PASSWORD'");
    expect(script).toContain('alter role :\\"role\\" login password :\'password\'');
    expect(script).not.toContain('--set=password=');
    expect(script).not.toMatch(/create role \$role login password/);
  });
});
