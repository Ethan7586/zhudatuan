/** Canonical journal evidence query fragment for period-close compare-and-set writes. */
export class JournalHashQuery {
  readonly cte = `current as(select encode(public.digest(coalesce(string_agg(journal.id||':'||entry.id||':'||entry.amount_minor,
    ',' order by journal.id,entry.id),''),'sha256'),'hex') hash from finance.journal journal
    join finance.entry entry on entry.journal_id=journal.id where journal.scope_id=$1 and journal.period=$2)`;
}
