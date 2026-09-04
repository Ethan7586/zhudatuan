import type { DeliveryRequest } from '@shop/contract';

import type { SmsConfiguration } from './Config';

export interface SmsTemplateSelection {
  readonly code: string;
  readonly variables: Readonly<Record<string, string | number | boolean>>;
}

export class SmsTemplateCatalog {
  constructor(private readonly configuration: Pick<SmsConfiguration, 'verificationTemplate' | 'templates' | 'optOut'>) {}

  resolve(request: DeliveryRequest): SmsTemplateSelection {
    if (request.purpose === 'verification') {
      if (request.providerTemplate !== null || Object.keys(request.variables).sort().join(',') !== 'code') throw new Error('SMS_VERIFICATION_TEMPLATE_ISOLATION_REQUIRED');
      return Object.freeze({ code: this.configuration.verificationTemplate, variables: request.variables });
    }
    if (!request.providerTemplate) throw new Error('SMS_TEMPLATE_REQUIRED');
    const selected = this.configuration.templates[request.purpose][request.providerTemplate];
    if (!selected) {
      const other = request.purpose === 'marketing' ? this.configuration.templates.transactional : this.configuration.templates.marketing;
      throw new Error(other[request.providerTemplate] ? 'SMS_TEMPLATE_PURPOSE_MISMATCH' : 'SMS_TEMPLATE_UNKNOWN');
    }
    if (request.purpose === 'transactional') return Object.freeze({ code: selected, variables: request.variables });
    if (Object.hasOwn(request.variables, this.configuration.optOut.variable)) throw new Error('SMS_OPTOUT_VARIABLE_RESERVED');
    return Object.freeze({
      code: selected,
      variables: Object.freeze({ ...request.variables, [this.configuration.optOut.variable]: this.configuration.optOut.text }),
    });
  }
}
