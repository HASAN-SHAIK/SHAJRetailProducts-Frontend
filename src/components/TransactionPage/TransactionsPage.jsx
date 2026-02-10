import React, { useEffect, useState } from 'react';
import './TransactionsPage.css';
import api from '../../utils/axios';
import InfoCard from '../common/InfoCard/InfoCard';
import BadgeStatus from '../common/BadgeStatus/BadgeStatus';
import HighlightedTable from '../common/HighlightedTable/HighLightedTable';
import TableComponent from '../common/TableComponent/TableComponent';
import LoadingSpinner from '../common/LoadingSpinner/LoadingSpinner';
import { usePopup } from '../common/PopUp/PopupProvider';



const TransactionsPage = ({navigate}) => {
  const [transactions, setTransactions] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showPopup } = usePopup();

  const formatToIST = (utcDate) => {
    if (!utcDate) return '';
    const date = new Date(utcDate);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  useEffect(() => {
    fetchTransactions().then(()=> setIsLoading(false));
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/transactions');
      setTransactions(res.data);
    } catch (err) {
          if(err.response.data.message === 'Invalid Token' || err.response.status === '400' || err.response.status == '401' || err.response.status === '403'){
      showPopup("Token Expired Please Login Again!", "Session");
      navigate('/logout');
    }
    else{
      console.error('Error fetching transactions:', err);
    }
    }
  };

  return (
    isLoading ? 
    <LoadingSpinner />
   :
   <div>
    <div className="container-fluid  pt-4 transactions-page">
      {/* <h2 className="mb-4 brand-title">Transactions</h2> */}
    { !transactions ? '': <>
      <div className="row mb-4">
        {transactions && transactions.total_income && <InfoCard title="Total Revenue" value={transactions&&transactions.total_income} icon="bi text-info bi-bank fs-1" />}
        {transactions && transactions.total_cash && <InfoCard title="Total Cash"  value={transactions&&transactions.total_cash} icon="bi text-light bi-cash-stack fs-1" />}
        {transactions && transactions.total_online && <InfoCard title="Total Online" value={transactions&&transactions.total_online} icon="bi text-primary bi-phone-flip fs-1" />}
        <InfoCard title="Total Transactions" value={transactions && transactions.transactions.length} icon="bi bi-arrow-down-up text-warning fs-1" />
        <InfoCard title="Success Rate" value="100%" icon="bi bi-hand-thumbs-up text-success fs-1" />
      </div>
      <HighlightedTable
        title={'Transactions'}
        columns={['OrderId', 'User', 'Amount(Mode)','Type', 'Status', 'Date']}
        data={transactions.transactions && transactions.transactions.map(txn => ({
          OrderId: txn.order_id,
          User: txn.user,
          'Amount(Mode)': `₹${txn.total_price}(${txn.payment_mode})`,
          Type: txn.transaction_type,
          Status: <BadgeStatus status={txn.order_status} />,
          Date: formatToIST(txn.transaction_date)
        }))}
      // <HighlightedTable
      //   columns={['OrderId', 'User', 'Amount(Mode)','Type', 'Status', 'Date']}
      //   data={transactions.transactions && transactions.transactions.map(txn => ({
      //     OrderId: txn.order_id,
      //     User: txn.user,
      //     'Amount(Mode)': `₹${txn.total_price}(${txn.payment_mode})`,
      //     Type: txn.transaction_type,
      //     Status: <BadgeStatus status={txn.order_status} />,
      //     Date: new Date(txn.transaction_date).toLocaleDateString()
      //   }))}
      />
      </>
  }
    </div>
      </div>
  );
};

export default TransactionsPage;
