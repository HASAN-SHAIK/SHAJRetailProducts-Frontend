import React from 'react';
import './HighlightedTable.css';

const HighlightedTable = ({ columns, data }) => {
  return (
    <div className="table-responsive shadow-sm rounded ">
      <table className="p-3 table table-hover table-box align-middle mb-0 text-center">
        <thead className="">
          <tr className='transactions-table-head'>
            {columns.map((col, idx) => (
              <th className='p-3 text-center' key={idx}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? data.map((row, i) => (
            <tr key={i} className='transactions-table-data text-center'>
              {columns.map((col, j) => (
                <td className='text-center' key={j}>{row[col]}</td>
              ))}
            </tr>
          )) : (
            <tr><td colSpan={columns.length} className="text-center text-muted">No Transactions</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default HighlightedTable;
