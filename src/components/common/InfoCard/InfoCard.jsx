import React from 'react';
import './InfoCard.css';

const InfoCard = ({ title, value, icon }) => {
  return (
    <div className="col-md-4 mb-3 ">
      <div className="info-card shadow-sm p-3 d-flex align-items-center justify-content-between">
        <div>
          <h6 className="mb-1 infocard-title">{title}</h6>
          <h4 className="fw-bold">{value}</h4>
        </div>
        <i class={icon}></i>
        {/* <i class="bi bi-cash-stack" style="font-size: 10px;"></i> */}
      </div>
    </div>
  );
};

export default InfoCard;