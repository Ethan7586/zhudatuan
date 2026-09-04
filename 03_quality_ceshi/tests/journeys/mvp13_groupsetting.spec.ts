import { journey } from './JourneyHarness';
journey('MVP13', { workstation: 'groupsetting', operations: ['access.center.read', 'access.roles.manage', 'partner.partners.manage', 'notification.templates.manage', 'risk.policies.manage'], tables: ['access.role', 'partner.partner', 'risk.policy'], event: 'risk.policy.activated' });
