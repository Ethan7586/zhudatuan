import { journey } from './JourneyHarness';
journey('MVP22', { workstation: 'mallsetting', operations: ['access.center.read', 'access.roles.manage', 'member.members.read', 'partner.partners.manage', 'notification.templates.manage', 'risk.policies.manage'], tables: ['access.role', 'access.membership', 'notification.template', 'risk.policy'], event: 'access.version.changed' });
