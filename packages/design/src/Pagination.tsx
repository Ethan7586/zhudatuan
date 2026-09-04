import { Button } from './atom/Button';

export function Pagination({ previous, next, onPrevious, onNext }: Readonly<{ previous?: string; next?: string; onPrevious?: (cursor: string) => void; onNext?: (cursor: string) => void }>) {
  if (!previous && !next) return null;
  return <nav className="pagination" aria-label="分页"><Button isDisabled={!previous || !onPrevious} onPress={() => previous && onPrevious?.(previous)}>上一页</Button><Button isDisabled={!next || !onNext} onPress={() => next && onNext?.(next)}>下一页</Button></nav>;
}
