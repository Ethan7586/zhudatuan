import { defineModule } from '../../../bootstrap/DefinedModule';
import { extensionRoutes } from './http/ExtensionRoutes';

export const ExtensionModule = defineModule('extension', ['capability'], extensionRoutes);
