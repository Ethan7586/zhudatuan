import React from 'react';
import { useMall } from '../../context/MallContext';
import { TabletLandscapeHome } from './TabletLandscapeHome';
import { TabletPortraitHome } from './TabletPortraitHome';

export const TabletHomePage: React.FC = () => {
  const { tabletOrientation } = useMall();
  return tabletOrientation === 'portrait' ? <TabletPortraitHome /> : <TabletLandscapeHome />;
};
