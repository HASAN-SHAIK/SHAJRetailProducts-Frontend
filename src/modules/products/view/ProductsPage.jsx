import React from 'react';
import useProductsVM from '../vm/useProductsVM';
import ProductsTable from '../components/ProductsTable';
import PriceEditTable from '../components/PriceEditTable';

const ProductsPage = () => {
  const vm = useProductsVM();

  return (
    <div className="container mt-3">
      <h3>Products (New)</h3>
      {vm.loading && <div>Loading...</div>}
      {vm.error && <div className="text-danger">{vm.error}</div>}
      <ProductsTable products={vm.products} />
      <div className="mt-4">
        <PriceEditTable products={vm.products} onSave={vm.savePriceEdits} />
      </div>
    </div>
  );
};

export default ProductsPage;
