import React from 'react';
import './HighlightedTable.css';

const HighlightedTable = ({ columns, data }) => {
  const normalizeKey = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  const getCellValue = (row, col) => {
    if (!row || typeof row !== 'object') return row ?? '';
    const direct = row[col];
    if (direct !== undefined) return direct;
    const normalizedCol = normalizeKey(col);
    const keys = Object.keys(row);
    for (const key of keys) {
      if (normalizeKey(key) === normalizedCol) {
        return row[key];
      }
    }
    return row[normalizedCol];
  };

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
                <td className='text-center' key={j}>{getCellValue(row, col)}</td>
              ))}
            </tr>
          )) : (
            <tr><td colSpan={columns.length} className="text-center text-secondary">No Transactions</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default HighlightedTable;

