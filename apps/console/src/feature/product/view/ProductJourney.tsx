import { JourneyGuide } from '@shop/design';
import type { ProductJourney as ProductJourneyModel } from '../model/ProductJourney';

export function ProductJourney({ journey }: Readonly<{ journey: ProductJourneyModel }>) {
  return (
    <div className="productjourney">
      <JourneyGuide
        eyebrow="上架主流程"
        title={journey.title}
        steps={journey.steps}
        footer={
          <p className="productjourneyhint" role="status">
            <strong>{journey.complete ? '当前结果' : '建议下一步'}：</strong>
            {journey.next.detail}
          </p>
        }
      />
    </div>
  );
}
