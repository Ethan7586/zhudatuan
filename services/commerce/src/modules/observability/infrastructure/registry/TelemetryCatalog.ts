import { TELEMETRY_ALERTS, TELEMETRY_HEALTH, TELEMETRY_SERVICE_LEVELS } from '@shop/telemetry';
import { ObservationRegistry } from '../../application/registry/ObservationRegistry';
import { AlertRule, type AlertRuleDefinition } from '../../domain/model/AlertRule';
import { ServiceLevel, type ServiceLevelDefinition } from '../../domain/model/ServiceLevel';

export const SERVICE_LEVEL_CATALOG = Object.freeze(Object.entries(TELEMETRY_SERVICE_LEVELS).map(([id, definition]) => new ServiceLevel({ id, ...definition } as ServiceLevelDefinition)));
export const ALERT_RULE_CATALOG = Object.freeze(Object.entries(TELEMETRY_ALERTS).map(([id, definition]) => new AlertRule({ id, ...definition } as AlertRuleDefinition)));

if (new Set(SERVICE_LEVEL_CATALOG.map(({ definition }) => definition.id)).size !== SERVICE_LEVEL_CATALOG.length) throw new Error('SERVICE_LEVEL_CATALOG_DUPLICATE');
if (new Set(ALERT_RULE_CATALOG.map(({ definition }) => definition.id)).size !== ALERT_RULE_CATALOG.length) throw new Error('ALERT_RULE_CATALOG_DUPLICATE');

export const OBSERVATION_REGISTRY = Object.freeze(new ObservationRegistry(TELEMETRY_HEALTH, SERVICE_LEVEL_CATALOG, ALERT_RULE_CATALOG));
