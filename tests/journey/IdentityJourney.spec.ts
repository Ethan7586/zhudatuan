import { journey } from './JourneyHarness';

journey('MVPIDENTITY', {
  workstation: 'identity',
  operations: ['identity.sessions.create', 'identity.sessions.complete', 'identity.challenges.create', 'identity.invitations.resolve', 'identity.enrollments.complete', 'identity.password.reset'],
  tables: ['identity.principal', 'identity.credential', 'identity.session', 'identity.invitation', 'access.membership', 'member.profile'],
  event: 'identity.member.reset',
});
