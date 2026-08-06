/**
 * @typedef {object} IStaffRepository
 * @property {(staff: object) => Promise<void>} upsertLocalStaff
 * @property {(filters?: object) => Promise<object[]>} getLocalStaff
 * @property {(staffId: string|number) => Promise<object|undefined>} getLocalStaffById
 * @property {(staffId: string|number) => Promise<void>} deleteLocalStaff
 * @property {(salary: object) => Promise<void>} upsertLocalSalary
 * @property {(filters?: object) => Promise<object[]>} getLocalSalaries
 * @property {(salaryId: string|number) => Promise<object|undefined>} getLocalSalaryById
 * @property {(salaryId: string|number) => Promise<void>} deleteLocalSalary
 * @property {(expense: object) => Promise<void>} upsertLocalExpense
 * @property {(filters?: object) => Promise<object[]>} getLocalExpenses
 * @property {(expenseId: string|number) => Promise<object|undefined>} getLocalExpenseById
 * @property {(expenseId: string|number) => Promise<void>} deleteLocalExpense
 * @property {() => Promise<object[]>} getStaffRecords
 * @property {() => Promise<object[]>} getSalaryRecords
 * @property {() => Promise<object[]>} getExpenseRecords
 * @property {(entry: object) => Promise<void>} putStaffRecord
 * @property {(entry: object) => Promise<void>} putSalaryRecord
 * @property {(entry: object) => Promise<void>} putExpenseRecord
 * @property {(callback: Function) => Promise<unknown>} runStaffSalariesExpensesTransaction
 * @property {(records: object[], idKey?: string) => Promise<void>} mergeRemoteStaffRecords
 * @property {(records: object[], idKey?: string) => Promise<void>} mergeRemoteSalaryRecords
 * @property {(records: object[], idKey?: string) => Promise<void>} mergeRemoteExpenseRecords
 */

export {};
