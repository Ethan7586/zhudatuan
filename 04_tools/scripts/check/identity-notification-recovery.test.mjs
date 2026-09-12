import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('identity notification jobs keep retrying across internal runtime recovery', () => {
  for (const unit of [
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/sfl-identity-notification-jobs@.service',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-identity-notification-jobs.service',
  ]) {
    const source = read(unit);
    assert.match(source, /^Wants=zhudatuan-internal-runtime\.service(?: docker\.service)?$/m);
    assert.doesNotMatch(source, /^Requires=.*zhudatuan-internal-runtime\.service/m);
    assert.match(source, /^After=.*zhudatuan-internal-runtime\.service/m);
    assert.match(source, /^Restart=on-failure$/m);
  }
});

test('a sovereign child node writes and claims notification jobs in its own scope', () => {
  const context = read('01_core_hexin/services/commerce/src/modules/identity/05_interface_jieru/http/RealmOperationContext.ts');
  const registration = read('01_core_hexin/services/commerce/src/modules/identity/05_interface_jieru/http/RegistrationOperations.ts');
  const worker = read('01_core_hexin/services/commerce/src/bootstrap/IdentityNotificationJobsRuntime.ts');

  assert.match(context, /notificationScope: manifest\?\.parent_node_id \? manifest\.node_id : undefined/);
  assert.match(registration, /notificationScope \?\? null/);
  assert.match(worker, /manifest\?\.node_id/);
});
