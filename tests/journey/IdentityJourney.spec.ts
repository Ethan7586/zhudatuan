import { journey } from './JourneyHarness';

journey('MVPIDENTITY', {
  workstation: 'identity',
  operations: ['identity.bootstrap.read', 'identity.sessions.create', 'identity.sessions.complete', 'identity.tickets.exchange', 'identity.challenges.create', 'identity.invitations.resolve', 'identity.enrollments.read', 'identity.enrollments.complete'],
  tables: ['identity.principal', 'identity.credential', 'identity.session', 'identity.invitation', 'access.membership', 'member.profile'],
  event: 'identity.member.reset',
});
