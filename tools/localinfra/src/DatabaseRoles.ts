import { parse } from 'yaml';

interface DatabaseObjectContract {
  readonly objects?: readonly {
    readonly kind?: unknown;
    readonly owner?: unknown;
  }[];
}

const moduleOwner = /^shop[a-z]+owner$/;
const expectedModules = 33;

export function moduleDatabaseRoles(source: string): readonly string[] {
  const contract = parse(source) as DatabaseObjectContract;
  if (!Array.isArray(contract.objects)) throw new Error('DATABASE_OBJECT_CONTRACT_INVALID');
  const owners = [...new Set(contract.objects.filter((item) => item.kind === 'schema' && typeof item.owner === 'string' && moduleOwner.test(item.owner)).map((item) => item.owner as string))].sort();
  if (owners.length !== expectedModules) throw new Error(`MODULE_DATABASE_ROLE_COUNT_INVALID:${owners.length}`);
  return Object.freeze(
    owners.flatMap((owner) => {
      const stem = owner.slice(0, -'owner'.length);
      return [owner, `${stem}reader`, `${stem}writer`];
    })
  );
}
