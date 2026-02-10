import React from "react";
import "./StatBox.css";

const StatBox = ({ label, value }) => {
  return (
    <div className="stat-box">
      <h5>{label}</h5>
      <p>{value}</p>
    </div>
  );
};
export default StatBox;