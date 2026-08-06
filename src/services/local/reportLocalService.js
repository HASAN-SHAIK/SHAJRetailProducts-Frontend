import { getReportRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';

export const {
  getDailyExpenseReport,
  getMonthlyExpenseReport,
  getStaffExpenses,
  getStaffExpenseTotal,
  getEwayBills,
} = createRepositoryFacade(() => getReportRepository(), [
  'getDailyExpenseReport',
  'getMonthlyExpenseReport',
  'getStaffExpenses',
  'getStaffExpenseTotal',
  'getEwayBills',
]);
