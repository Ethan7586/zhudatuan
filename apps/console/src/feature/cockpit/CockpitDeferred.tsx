import { memo, useEffect, useState } from 'react';

import { BusinessEvents, BusinessInsights, MallComparison } from './CockpitDetails';
import type { BusinessInsight, CockpitSales } from './CockpitSchema';
import { CockpitTrend } from './CockpitTrend';

const DeferredTrend = memo(CockpitTrend);
const DeferredMalls = memo(MallComparison);
const DeferredEvents = memo(BusinessEvents);
const DeferredInsights = memo(BusinessInsights);

export default function CockpitDeferred({ sales, onOpenInsight }: Readonly<{
  sales: CockpitSales;
  onOpenInsight: (insight: BusinessInsight) => void;
}>) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= 3) return undefined;
    const timer = window.setTimeout(() => setStage((current) => current + 1));
    return () => window.clearTimeout(timer);
  }, [stage]);
  return (
    <div className="cockpitdeferred">
      <div className="cockpitprimarygrid">
        {stage >= 1 ? <DeferredTrend sales={sales} /> : null}
        {stage >= 2 ? <DeferredMalls malls={sales.malls ?? []} /> : null}
      </div>
      <div className="cockpitsecondarygrid">
        {stage >= 3 ? <DeferredEvents events={sales.events ?? []} /> : null}
        {stage >= 3 ? <DeferredInsights insights={sales.insights ?? []} onOpen={onOpenInsight} /> : null}
      </div>
    </div>
  );
}
