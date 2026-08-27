import { DeviceShowcase } from '../../src/showcase/DeviceShowcase';

/**
 * Multi-device entry route.
 *
 * These device previews use the same approved component family as the
 * production storefront. Local demo data remains isolated to preview routes.
 */
type DevicePageProps = {
  params: Promise<{ device: string }>;
};

export default async function DevicePage({ params }: DevicePageProps) {
  const { device } = await params;
  return <DeviceShowcase initialPath={`/${device}`} />;
}
