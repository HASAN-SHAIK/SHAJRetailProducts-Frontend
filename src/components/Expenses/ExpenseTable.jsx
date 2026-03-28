import React from 'react';

const ExpenseTable = ({ expenses, formatDate, formatMoney }) => (
  <div className="expenses-table-wrapper">
    <table className="expenses-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Name</th>
          <th className="text-end">Amount</th>
        </tr>
      </thead>
      <tbody>
        {expenses.length === 0 && (
          <tr>
            <td colSpan={4} className="text-center">No expenses found.</td>
          </tr>
        )}
        {expenses.map((expense) => (
          <tr key={expense.id}>
            <td>{formatDate(expense.date)}</td>
            <td className="text-capitalize">{expense.type}</td>
            <td>{expense.name}</td>
            <td className="text-end">{formatMoney(expense.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ExpenseTable;
