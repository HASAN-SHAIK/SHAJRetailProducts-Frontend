import React from 'react';
import Table from '../../../ui/Table';

const ProductsTable = ({ products }) => {
  return (
    <Table className="table-sm">
      <thead>
        <tr>
          <th>Name</th>
          <th>Company</th>
          <th>MRP</th>
          <th>Selling</th>
          <th>GST%</th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <tr key={p.id}>
            <td>{p.name || p.product_name}</td>
            <td>{p.company || p.company_name || '-'}</td>
            <td>{p.mrp || '-'}</td>
            <td>{p.selling_price}</td>
            <td>{p.gst_percentage || p.gst_percent || 0}</td>
          </tr>
        ))}
        {products.length === 0 && (
          <tr>
            <td colSpan={5} className="text-muted">No products.</td>
          </tr>
        )}
      </tbody>
    </Table>
  );
};

export default ProductsTable;
