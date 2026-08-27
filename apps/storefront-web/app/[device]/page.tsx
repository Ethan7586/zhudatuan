import { DeviceShowcase } from '../../src/showcase/DeviceShowcase';

/**
 * Multi-device entry route.
 *
 * These legacy visual simulators are intentionally isolated from the
 * production storefront entry and native WeChat mini program.
 */
type DevicePageProps = {
  params: Promise<{ device: string }>;
};

export default async function DevicePage({ params }: DevicePageProps) {
  const { device } = await params;
  return <DeviceShowcase initialPath={`/${device}`} />;
}
