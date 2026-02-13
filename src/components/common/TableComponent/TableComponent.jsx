import React, { useEffect } from "react";
import { useState } from "react";
import "./TableComponent.css";
import api from "../../../utils/axios";
import EditProductModal from "../../ProductsPage/EditOrderModal/EditProductModal";
import { usePopup } from "../PopUp/PopupProvider";

const TableComponent = ({ title, columns, data, setProductUpdateFlag, color }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const { showPopup } = usePopup();

  const isWeightBasedValue = (value) => {
    if (value === true) return true;
    if (value === false || value == null) return false;
    if (typeof value === 'number') return value === 1;
    const normalized = value.toString().trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'weight', 'weighted', 'kg'].includes(normalized);
  };
  
  const handleEditClick = (item) => {
    setSelectedItem(item);
    setShowEditModal(true);
  };

  const handleSubmitEdit = async (updatedProduct) => {
    try {
      const response = await api.put(`/products/${updatedProduct.id}`, updatedProduct);
  
      if (response.status === 200) {
        showPopup('Product updated successfully!', 'Success');
        handleCloseModal();
        if (setProductUpdateFlag) {
          setProductUpdateFlag((prev) => !prev);
        }
      }
    } catch (error) {
      console.error('Failed to update order:', error);
      showPopup('Error updating order', 'Error');
    }
  };
  const handleCloseModal = () => {
    setShowEditModal(false);
    setSelectedItem(null);
  };

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
    <div  className="table-box text-center">

      <h4 style={{color: color}}> {title}</h4>
      <div className="responsive-table">
        <table>
      {/* <div className="floating-shape circle red"></div>
      <div className="floating-shape triangle purple"></div> */}
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th  key={i}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
        {/* <div className="floating-shape tablecircle red"></div>
        <div className="floating-shape triangle purple"></div>
        <div className="floating-shape square yellow"></div>
        <div className="floating-shape wave pink"></div>
        <div className="floating-shape tablering orange"></div>
        <div className="floating-shape tablecube green"></div> */}
          {data && data.length > 0 ? data.map((row, i) => (
            <tr key={i}>
              {columns.map((col, j) => {
                const normalized = col.toLowerCase();
                if (normalized === 'edit') {
                  return (
                    <button key={`${i}-${j}-edit`} onClick={() => handleEditClick(row)} className="btn btn-info m-1">
                      Edit
                    </button>
                  );
                }
                if (normalized === 'type') {
                  const weightSource =
                    row?.is_weight_based ??
                    row?.type ??
                    row?.product_type ??
                    row?.unit ??
                    row?.unit_type ??
                    row?.measure;
                  const isWeightBased =
                    isWeightBasedValue(weightSource) ||
                    (typeof row?.name === 'string' && row.name.toLowerCase().includes('kg')) ||
                    (typeof row?.product_name === 'string' && row.product_name.toLowerCase().includes('kg'));
                  return (
                    <td key={j}>
                      <span className={`product-type-badge ${isWeightBased ? 'badge-weight' : 'badge-piece'}`}>
                        [{isWeightBased ? 'Weight' : 'Piece'}]
                      </span>
                    </td>
                  );
                }
                return <td key={j}>{getCellValue(row, col)}</td>;
              })}
            </tr>
          )) : (
            <tr><td colSpan={columns.length}>No Data</td></tr>
          )}
        </tbody>
        </table>
      </div>
      {showEditModal && (
        <EditProductModal
          item={selectedItem}
          columns = {columns}
          onClose={handleCloseModal}
          onSubmit={handleSubmitEdit}
        />
      )}
    </div>
  );
};

export default TableComponent;
