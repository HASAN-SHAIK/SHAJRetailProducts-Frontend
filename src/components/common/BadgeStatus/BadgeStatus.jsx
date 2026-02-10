import React from 'react';

const BadgeStatus = ({ status }) => {
  const getColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'cancelled': return 'danger';
      case 'pending': return 'warning';
      default: return 'secondary';
    }
  };
  if(status === 'completed')
  return <span className={`text-${getColor(status)}`}><i class="bi bi-check2-circle fs-4"></i></span>
  else if(status === 'cancelled')
  return <span className={`text-${getColor(status)}`}><i class="bi bi-x-circle fs-4"></i></span>
  else
  return <span className={`text-${getColor(status)}`}><i class="bi bi-cloud-arrow-down fs-4"></i></span>
};

export default BadgeStatus;