import { useState } from 'react';
import { Button } from '../atom/Button';
import './Molecule.css';

export function BusinessRef({ label = '业务编号', reference, copyValue = reference }: Readonly<{ label?: string; reference: string; copyValue?: string }>) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(copyValue);
    setCopied(true);
  };
  return <span className="shopbusinessref"><span><small>{label}</small><code>{reference}</code></span><Button tone="quiet" onPress={() => void copy()} aria-label={`复制${label}`}>{copied ? '已复制' : '复制'}</Button></span>;
}
