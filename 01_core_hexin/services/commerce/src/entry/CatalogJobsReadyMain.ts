import { catalogJobsEnvironment, createCatalogJobsRuntime } from '../bootstrap/CatalogJobsRuntime';

const runtime = await createCatalogJobsRuntime(catalogJobsEnvironment());
await runtime.close();
process.stdout.write('ZHUDATUAN_CATALOG_JOBS_READY\n');
