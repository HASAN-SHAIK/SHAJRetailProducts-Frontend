import React from 'react';
import ProductsPage from '../../components/ProductsPage';

const ProductCatalog = ({ navigate, userRole }) => {
  return <ProductsPage navigate={navigate} userRole={userRole} />;
};

export default ProductCatalog;
