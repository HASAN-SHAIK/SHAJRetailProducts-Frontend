import React, { useState } from 'react';

const ExpenseForm = ({ onSubmit, isSubmitting }) => {
  const [type, setType] = useState('staff');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      type,
      name: name.trim(),
      amount: Number(amount),
      description: description.trim(),
    };
    await onSubmit(payload);
    setName('');
    setAmount('');
    setDescription('');
  };

  return (
    <form className="expense-form" onSubmit={handleSubmit}>
      <div className="row g-2">
        <div className="col-md-3">
          <label className="form-label">Type</label>
          <select
            className="form-select"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="staff">Staff</option>
            <option value="shop">Shop</option>
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label">Name</label>
          <input
            className="form-control"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Ravi Salary"
            required
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Amount</label>
          <input
            className="form-control"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Description</label>
          <input
            className="form-control"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>
      <div className="mt-3">
        <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Add Expense'}
        </button>
      </div>
    </form>
  );
};

export default ExpenseForm;
