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
  const [selectedRange, setSelectedRange] = useState('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customRangeKey, setCustomRangeKey] = useState(0);
  const { showPopup } = usePopup();
  const hasNonZeroValue = (value) => {
    if (value === null || value === undefined) return false;
    const num = Number(value);
    return Number.isFinite(num) && num > 0;
  };

  const formatMoney = (value) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  };

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
    fetchTransactions();
  }, [selectedRange, customRangeKey]);

  const buildRangeParams = () => {
    const params = { range: selectedRange };
    if (selectedRange === 'custom') {
      params.start_date = customStartDate;
      params.end_date = customEndDate;
    }
    return params;
  };

  const fetchTransactions = async () => {
    if (selectedRange === 'custom' && (!customStartDate || !customEndDate)) {
      return;
    }
    try {
      setIsLoading(true);
      const res = await api.get('/transactions', { params: buildRangeParams() });
      setTransactions(res.data);
    } catch (err) {
        if(err.response.data.message === 'Invalid Token' || err.response.status == '401'){
          showPopup("Token Expired Please Login Again!", "Session");
          navigate('/logout');
        }
    else{
      console.error('Error fetching transactions:', err);
    }
    }
    finally{
      setIsLoading(false);
    }
  };

  const totalTransactions = Array.isArray(transactions?.transactions)
    ? transactions.transactions.length
    : 0;

  const handleRangeChange = (value) => {
    setSelectedRange(value);
  };

  const handleApplyCustomRange = () => {
    if (!customStartDate || !customEndDate) {
      showPopup('Please select start and end dates', 'Validation');
      return;
    }
    setCustomRangeKey((prev) => prev + 1);
  };

  return (
    isLoading ? 
    <LoadingSpinner />
   :
   <div>
    <div className="container-fluid  pt-4 transactions-page">
      <div className="transactions-page-header">
        <div>
          {/* <h2 className="transactions-title">Transactions</h2> */}
          <p className="transactions-subtitle">Track payments and status across orders.</p>
        </div>
        <div className="transactions-range">
          <select
            className="form-select range-select"
            value={selectedRange}
            onChange={(e) => handleRangeChange(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>
          {selectedRange === 'custom' && (
            <div className="range-custom">
              <input
                type="date"
                className="form-control"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
              <span className="range-separator">to</span>
              <input
                type="date"
                className="form-control"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
              <button className="btn btn-primary btn-sm" onClick={handleApplyCustomRange}>
                Apply
              </button>
            </div>
          )}
        </div>
      </div>
    { !transactions ? '': <>
      <div className="row mb-4">
        {hasNonZeroValue(transactions?.total_income) && (
          <InfoCard title="Total Revenue" value={formatMoney(transactions.total_income)} icon="bi text-info bi-bank fs-1" />
        )}
        {hasNonZeroValue(transactions?.total_cash) && (
          <InfoCard title="Total Cash"  value={formatMoney(transactions.total_cash)} icon="bi text-light bi-cash-stack fs-1" />
        )}
        {hasNonZeroValue(transactions?.total_online) && (
          <InfoCard title="Total Online" value={formatMoney(transactions.total_online)} icon="bi text-primary bi-phone-flip fs-1" />
        )}
        {hasNonZeroValue(transactions?.profit) && (
          <InfoCard title="Total Profit" value={formatMoney(transactions.profit)} icon="bi text-success bi-graph-up-arrow fs-1" />
        )}
        {totalTransactions > 0 && (
          <InfoCard title="Total Transactions" value={totalTransactions} icon="bi bi-arrow-down-up text-warning fs-1" />
        )}
        {totalTransactions > 0 && (
          <InfoCard title="Success Rate" value="100%" icon="bi bi-hand-thumbs-up text-success fs-1" />
        )}
      </div>
      <HighlightedTable
        title={'Transactions'}
        columns={['Order ID', 'Amount', 'Profit', 'Payment Mode', 'Status', 'Date']}
        data={(transactions?.transactions || []).map(txn => ({
          'Order ID': txn.order_id,
          Amount: formatMoney(txn.total_price),
          Profit: formatMoney(txn.profit),
          'Payment Mode': txn.payment_mode,
          Status: <BadgeStatus status={txn.order_status} />,
          Date: formatToIST(txn.created_at),
        }))}
      // <HighlightedTable
      //   columns={['Order ID', 'Amount', 'Profit', 'Payment Mode', 'Status', 'Date']}
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
