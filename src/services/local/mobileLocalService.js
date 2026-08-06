import { getMobileRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';

export const { getDashboard, getSalesSummary, getLowStock } = createRepositoryFacade(() => getMobileRepository(), [
  'getDashboard',
  'getSalesSummary',
  'getLowStock',
]);
