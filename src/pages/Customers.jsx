import React, { useEffect, useState } from 'react';
import { getAllCustomers } from '../core/db';

const Customers = () => {
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    getAllCustomers()
      .then((list) => setCustomers(Array.isArray(list) ? list : []))
      .catch(() => setCustomers([]));
  }, []);

  return (
    <div className="billing-page">
      <div className="billing-center">
        <div className="billing-header">
          <h5 className="mb-0">Customers</h5>
        </div>
        <div className="billing-table-wrapper">
          <table className="billing-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Location</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id || customer.mobile}>
                  <td>{customer.name || '-'}</td>
                  <td>{customer.mobile || customer.phone || '-'}</td>
                  <td>{customer.location || '-'}</td>
                  <td>{customer.address || '-'}</td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={4} className="billing-empty">No customers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Customers;
