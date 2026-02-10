import React, { useEffect, useState } from 'react';
import './AddProductModalComponent.css'; // Add this CSS file
import api from '../../../utils/axios';
import { usePopup } from '../../common/PopUp/PopupProvider';

const AddProductModalComponent = ({ modalId, title, fields, formData, onChange, onSubmit, navigate }) => {
  const [categories, setCategories] = useState([]);
  const { showPopup } = usePopup();
  useEffect(() => {
    const getCategories = async () => {
      try {
        const res = await api.get('/orders/getcategories');
        const list = Array.isArray(res.data?.data)
          ? res.data.data.map((c) => c.category).filter(Boolean)
          : Array.isArray(res.data)
            ? res.data.map((c) => c.category).filter(Boolean)
            : [];
        setCategories(list);
      } catch (err) {
        if ((err.response?.data && err.response.data.message === 'Access Denied') || err.response?.status === 400 || err.response?.status == 401 || err.response?.status === 403) {
          showPopup("Token Expired Please Login Again!", "Session");
          navigate('/logout');
        } else {
          console.log(err);
        }
      }
    };
    getCategories();
  }, [navigate, showPopup]);
  return (
    <div className="modal fade ml-5" id={modalId} tabIndex="-1" aria-labelledby={`${modalId}Label`} aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered custom-modal-width">
        <form onSubmit={onSubmit}>
          <div className="modal-content custom-modal">
            <div className="modal-header border-0">
              <h5 className="modal-title fw-bold text-primary" id={`${modalId}Label`}>{title}</h5>
              <button type="button" className="btn-close custom-close bg-danger position-absolute end-0 m-5" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div className="modal-body">
              {fields.map(({ label, name, type }) => (
                <div className="form-group mb-3" key={name}>
                  <label htmlFor={name} className="form-label text-light">{label}</label>
                  {
                    (type === 'select') ? (
                    <>
                      <input
                        list="categories-list"
                        className="form-control custom-input"
                        id={name}
                        name={name}
                        value={formData[name] || ''}
                        onChange={onChange}
                        required
                        placeholder={`Select or type ${label}`}
                      />
                      <datalist id="categories-list">
                        {categories && categories.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </datalist>
                    </>
                    ): (
                  <input
                    type={type || 'text'}
                    className="form-control custom-input"
                    id={name}
                    name={name}
                    value={formData[name] || ''}
                    onChange={onChange}
                    required
                  />)
                }
                </div>
              ))}
            </div>

            <div className="modal-footer border-0">
              <button type="button" className="btn btn-light custom-btn" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" className="btn btn-primary custom-btn">Save</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProductModalComponent;
