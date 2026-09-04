export const ORGANIZATION_CAPABILITIES = Object.freeze({
  layersRead: 'organization.layers.read',
});

export type OrganizationCapability = (typeof ORGANIZATION_CAPABILITIES)[keyof typeof ORGANIZATION_CAPABILITIES];
