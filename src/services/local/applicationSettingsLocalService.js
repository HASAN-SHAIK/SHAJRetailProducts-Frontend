import { getApplicationSettingsRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';

export const {
  getApplicationSettings,
  updateApplicationSettings,
  getSettingGroup,
  updateSettingGroup,
} = createRepositoryFacade(() => getApplicationSettingsRepository(), [
  'getApplicationSettings',
  'updateApplicationSettings',
  'getSettingGroup',
  'updateSettingGroup',
]);
