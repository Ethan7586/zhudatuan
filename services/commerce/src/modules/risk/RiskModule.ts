import { defineModule } from '../../bootstrap/DefinedModule';
import { riskRoutes } from './interface/http/RiskRoutes';
import { Manifest } from './Manifest';
import { CheckoutRisk } from './CheckoutRisk';
import { CHECKOUT_RISK_PORT } from './public';
export const RiskModule = defineModule(Manifest, riskRoutes, [{ token: CHECKOUT_RISK_PORT, value: new CheckoutRisk() }]);
