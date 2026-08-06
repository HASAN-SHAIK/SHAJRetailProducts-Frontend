/**
 * @typedef {object} IReportRepository
 * @property {(options?: { date?: string }) => Promise<{ total: number, categories: Array<{ category: string, amount: number }> }>} getDailyExpenseReport
 * @property {(options?: { month?: string }) => Promise<{ total: number, categories: Array<{ category: string, amount: number }> }>} getMonthlyExpenseReport
 * @property {(options?: { staffId?: string|null, type?: string }) => Promise<object[]>} getStaffExpenses
 * @property {(options?: { staffId?: string, from?: string, to?: string }) => Promise<number>} getStaffExpenseTotal
 * @property {() => Promise<object[]>} getEwayBills
 */

export {};
