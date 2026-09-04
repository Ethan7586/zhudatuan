import { createFetchNavigationTreeRead } from '@shop/sdk/navigation';
import { appConfig } from '../config/AppConfig';

export const navigationTreeRead = createFetchNavigationTreeRead(appConfig.apiBaseUrl);
