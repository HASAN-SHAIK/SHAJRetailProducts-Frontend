import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReturnsHeader from '../../components/returnsCorrections/ReturnsHeader';
import { getLocalGstEntries } from '../../services/local';
import { fetchGstFilingData } from '../../services/returnsCorrectionsApi';
import './ReturnsCorrections.css';

const formatCurrency = (val) => {
  const n = Number(val || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

const formatNumber = (val) => {
  const n = Number(val || 0);
  return new Intl.NumberFormat('en-IN').format(n);
};

const SCHEDULE_TABS = [
  { id: 'b2b', label: 'B2B Invoices (Table 4)', badgeKey: 'b2b' },
  { id: 'b2c_small', label: 'B2C Small (Table 7)', badgeKey: 'b2c_small' },
  { id: 'b2c_large', label: 'B2C Large (Table 5)', badgeKey: 'b2c_large' },
  { id: 'credit_notes', label: 'Credit / Debit Notes (Table 9B)', badgeKey: 'credit_notes' },
  { id: 'summary', label: 'GSTR-3B Tax Summary', badgeKey: null },
];

const GstFilingData = () => {
  const [data, setData] = useState({
    b2b: [],
    b2c: [],
    b2c_small: [],
    b2c_large: [],
    credit_notes: [],
    raw: [],
    totals: null,
  });
  const [activeTab, setActiveTab] = useState('b2b');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const partitionLocalRows = useCallback((rows) => {
    const b2b = [];
    const b2cSmall = [];
    const b2cLarge = [];
    const creditNotes = [];

    for (const row of rows) {
      const isReturn = String(row.type || '').toUpperCase() === 'RETURN';
      const taxable = Number(row.taxable_amount || row.taxableAmount || 0);
      const cgst = Number(row.cgst || 0);
      const sgst = Number(row.sgst || 0);
      const igst = Number(row.igst || 0);
      const totalTax = Number(row.total_tax || row.totalTax || cgst + sgst + igst);
      const invoiceTotal = Number(row.total_price || taxable + totalTax);
      const customerGstin = String(row.customer_gstin || row.gstin || '').trim();
      const isInterState = igst > 0;

      const item = {
        billId: row.bill_id || row.billId || row.id,
        orderNumber: row.order_number || row.orderNumber || String(row.bill_id || row.id || '-'),
        type: row.type || (isReturn ? 'RETURN' : 'SALE'),
        date: row.date,
        customerName: row.customer_name || 'Retail Customer',
        customerGstin,
        placeOfSupply: row.place_of_supply || (isInterState ? 'Inter-State' : 'Intra-State'),
        taxableAmount: taxable,
        cgst,
        sgst,
        igst,
        totalTax,
        invoiceTotal,
      };

      if (isReturn) {
        creditNotes.push(item);
      } else if (customerGstin.length >= 5) {
        b2b.push(item);
      } else if (isInterState && invoiceTotal > 250000) {
        b2cLarge.push(item);
      } else {
        b2cSmall.push(item);
      }
    }

    return {
      b2b,
      b2c: [...b2cSmall, ...b2cLarge],
      b2c_small: b2cSmall,
      b2c_large: b2cLarge,
      credit_notes: creditNotes,
      raw: rows,
      totals: null,
    };
  }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    if (navigator.onLine) {
      try {
        const filingData = await fetchGstFilingData({ from, to });
        setIsOffline(false);
        const b2cSmall = Array.isArray(filingData?.b2c_small)
          ? filingData.b2c_small
          : Array.isArray(filingData?.b2c)
          ? filingData.b2c.filter((r) => !r.customerGstin && !r.customer_gstin)
          : [];
        const b2cLarge = Array.isArray(filingData?.b2c_large) ? filingData.b2c_large : [];

        setData({
          b2b: Array.isArray(filingData?.b2b) ? filingData.b2b : [],
          b2c: Array.isArray(filingData?.b2c) ? filingData.b2c : [],
          b2c_small: b2cSmall,
          b2c_large: b2cLarge,
          credit_notes: Array.isArray(filingData?.credit_notes) ? filingData.credit_notes : [],
          raw: Array.isArray(filingData?.raw) ? filingData.raw : [],
          totals: filingData?.totals || null,
        });
        setLoading(false);
        return;
      } catch {
        // Fallback to local IndexedDB
      }
    }

    setIsOffline(true);
    const localEntries = await getLocalGstEntries({ from, to });
    setData(partitionLocalRows(localEntries));
    setLoading(false);
  }, [from, to, partitionLocalRows]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Active items for selected schedule tab
  const activeItems = useMemo(() => {
    if (activeTab === 'b2b') return data.b2b;
    if (activeTab === 'b2c_small') return data.b2c_small;
    if (activeTab === 'b2c_large') return data.b2c_large;
    if (activeTab === 'credit_notes') return data.credit_notes;
    return [];
  }, [activeTab, data]);

  // Tab totals
  const activeTotals = useMemo(() => {
    return activeItems.reduce(
      (acc, item) => ({
        taxable: acc.taxable + Number(item.taxableAmount || item.taxable_amount || 0),
        cgst: acc.cgst + Number(item.cgst || 0),
        sgst: acc.sgst + Number(item.sgst || 0),
        igst: acc.igst + Number(item.igst || 0),
        totalTax: acc.totalTax + Number(item.totalTax || item.total_tax || 0),
        invoiceTotal: acc.invoiceTotal + Number(item.invoiceTotal || item.invoice_total || 0),
      }),
      { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, invoiceTotal: 0 }
    );
  }, [activeItems]);

  // Comprehensive summary (GSTR-3B Net Liability)
  const gstr3bSummary = useMemo(() => {
    const sumList = (list) =>
      list.reduce(
        (acc, item) => ({
          taxable: acc.taxable + Number(item.taxableAmount || item.taxable_amount || 0),
          cgst: acc.cgst + Number(item.cgst || 0),
          sgst: acc.sgst + Number(item.sgst || 0),
          igst: acc.igst + Number(item.igst || 0),
          totalTax: acc.totalTax + Number(item.totalTax || item.total_tax || 0),
        }),
        { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 }
      );

    const b2bTot = sumList(data.b2b);
    const b2cSmallTot = sumList(data.b2c_small);
    const b2cLargeTot = sumList(data.b2c_large);
    const returnsTot = sumList(data.credit_notes);

    const grossTaxable = b2bTot.taxable + b2cSmallTot.taxable + b2cLargeTot.taxable;
    const netTaxable = grossTaxable - returnsTot.taxable;
    const netCgst = b2bTot.cgst + b2cSmallTot.cgst + b2cLargeTot.cgst - returnsTot.cgst;
    const netSgst = b2bTot.sgst + b2cSmallTot.sgst + b2cLargeTot.sgst - returnsTot.sgst;
    const netIgst = b2bTot.igst + b2cSmallTot.igst + b2cLargeTot.igst - returnsTot.igst;
    const netTotalTax = b2bTot.totalTax + b2cSmallTot.totalTax + b2cLargeTot.totalTax - returnsTot.totalTax;

    return {
      b2b: b2bTot,
      b2cSmall: b2cSmallTot,
      b2cLarge: b2cLargeTot,
      returns: returnsTot,
      net: {
        taxable: netTaxable,
        cgst: netCgst,
        sgst: netSgst,
        igst: netIgst,
        totalTax: netTotalTax,
      },
    };
  }, [data]);

  // CSV Export utility
  const exportCsv = (scheduleName, items) => {
    const headers = [
      'Schedule',
      'Invoice / Return No',
      'Date',
      'Customer Name',
      'Customer GSTIN',
      'Place of Supply',
      'Taxable Value',
      'CGST',
      'SGST',
      'IGST',
      'Total Tax',
      'Invoice Total',
    ];

    const escapeCsv = (val) => {
      const s = String(val ?? '').replace(/"/g, '""');
      return /[",\n\r]/.test(s) ? `"${s}"` : s;
    };

    const lines = [headers.join(',')];

    const appendItems = (label, list) => {
      for (const item of list) {
        lines.push(
          [
            escapeCsv(label),
            escapeCsv(item.orderNumber || item.order_number),
            escapeCsv(item.date ? String(item.date).slice(0, 10) : ''),
            escapeCsv(item.customerName || item.customer_name),
            escapeCsv(item.customerGstin || item.customer_gstin),
            escapeCsv(item.placeOfSupply || item.place_of_supply),
            Number(item.taxableAmount || item.taxable_amount || 0).toFixed(2),
            Number(item.cgst || 0).toFixed(2),
            Number(item.sgst || 0).toFixed(2),
            Number(item.igst || 0).toFixed(2),
            Number(item.totalTax || item.total_tax || 0).toFixed(2),
            Number(item.invoiceTotal || item.invoice_total || 0).toFixed(2),
          ].join(',')
        );
      }
    };

    if (scheduleName === 'ALL') {
      appendItems('B2B (Table 4)', data.b2b);
      appendItems('B2C Large (Table 5)', data.b2c_large);
      appendItems('B2C Small (Table 7)', data.b2c_small);
      appendItems('Credit / Debit Notes (Table 9B)', data.credit_notes);
    } else {
      appendItems(scheduleName, items);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    const dateSuffix = from || to ? `_${from || 'start'}_to_${to || 'now'}` : '';
    link.setAttribute('download', `GSTR1_${scheduleName.replace(/\s+/g, '_')}${dateSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSetThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    setFrom(firstDay);
    setTo(lastDay);
  };

  const handleSetLastMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    setFrom(firstDay);
    setTo(lastDay);
  };

  const handleClearDates = () => {
    setFrom('');
    setTo('');
  };

  return (
    <div className="returns-page">
      <ReturnsHeader title="GST Filing Schedules (GSTR-1 & GSTR-3B)" />

      {/* Control / Filter Bar */}
      <div className="returns-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>From:</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '12px' }}
            />
          </label>
          <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>To:</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '12px' }}
            />
          </label>
          <button className="btn btn-sm btn-outline-secondary" onClick={handleSetThisMonth} style={{ fontSize: '11px' }}>
            This Month
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={handleSetLastMonth} style={{ fontSize: '11px' }}>
            Last Month
          </button>
          {(from || to) && (
            <button className="btn btn-sm btn-outline-light" onClick={handleClearDates} style={{ fontSize: '11px' }}>
              Clear
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => exportCsv(SCHEDULE_TABS.find((t) => t.id === activeTab)?.label || activeTab, activeItems)}
            disabled={activeTab === 'summary' || activeItems.length === 0}
            style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="bi bi-file-earmark-spreadsheet" /> Export Active Schedule CSV
          </button>
          <button
            className="btn btn-sm btn-success"
            onClick={() => exportCsv('ALL', [])}
            disabled={data.raw.length === 0}
            style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="bi bi-download" /> Export Full GSTR-1 Package
          </button>
        </div>
      </div>

      {isOffline && (
        <div className="offline-chip" style={{ alignSelf: 'start' }}>
          Offline Mode · Rendering local Dexie GST ledger entries
        </div>
      )}

      {/* GSTR-3B Net Liability Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div className="returns-card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
            Net Taxable Turnover
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
            {formatCurrency(gstr3bSummary.net.taxable)}
          </div>
        </div>
        <div className="returns-card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
            Central Tax (CGST)
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#4ade80', marginTop: '4px' }}>
            {formatCurrency(gstr3bSummary.net.cgst)}
          </div>
        </div>
        <div className="returns-card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
            State Tax (SGST)
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#4ade80', marginTop: '4px' }}>
            {formatCurrency(gstr3bSummary.net.sgst)}
          </div>
        </div>
        <div className="returns-card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
            Integrated Tax (IGST)
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#fbbf24', marginTop: '4px' }}>
            {formatCurrency(gstr3bSummary.net.igst)}
          </div>
        </div>
        <div className="returns-card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
            Total Net Tax Liability
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#f43f5e', marginTop: '4px' }}>
            {formatCurrency(gstr3bSummary.net.totalTax)}
          </div>
        </div>
      </div>

      {/* Schedule Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', paddingBottom: '4px', flexWrap: 'wrap' }}>
        {SCHEDULE_TABS.map((tab) => {
          const count = tab.badgeKey ? (data[tab.badgeKey] || []).length : null;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: isActive ? '#0284c7' : 'rgba(15, 23, 42, 0.4)',
                color: isActive ? '#ffffff' : '#94a3b8',
                border: '1px solid',
                borderColor: isActive ? '#38bdf8' : 'rgba(148, 163, 184, 0.2)',
                borderRadius: '8px 8px 0 0',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {tab.label}
              {count !== null && (
                <span
                  style={{
                    background: isActive ? '#ffffff' : 'rgba(148, 163, 184, 0.2)',
                    color: isActive ? '#0284c7' : '#e2e8f0',
                    padding: '2px 6px',
                    borderRadius: '12px',
                    fontSize: '10px',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content */}
      <div className="returns-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '13px' }}>
            <i className="bi bi-arrow-repeat spin" style={{ marginRight: '8px' }} /> Loading GST filing schedules...
          </div>
        ) : activeTab === 'summary' ? (
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: '#e2e8f0' }}>
              Consolidated GSTR-3B Outward Tax Summary
            </h3>
            <table className="returns-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Filing Schedule Category</th>
                  <th style={{ textAlign: 'right' }}>Voucher Count</th>
                  <th style={{ textAlign: 'right' }}>Taxable Value (₹)</th>
                  <th style={{ textAlign: 'right' }}>CGST (₹)</th>
                  <th style={{ textAlign: 'right' }}>SGST (₹)</th>
                  <th style={{ textAlign: 'right' }}>IGST (₹)</th>
                  <th style={{ textAlign: 'right' }}>Total Tax (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>B2B Invoices (Table 4)</strong></td>
                  <td style={{ textAlign: 'right' }}>{data.b2b.length}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(gstr3bSummary.b2b.taxable)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(gstr3bSummary.b2b.cgst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(gstr3bSummary.b2b.sgst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(gstr3bSummary.b2b.igst)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(gstr3bSummary.b2b.totalTax)}</td>
                </tr>
                <tr>
                  <td><strong>B2C Small Invoices (Table 7)</strong></td>
                  <td style={{ textAlign: 'right' }}>{data.b2c_small.length}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(gstr3bSummary.b2cSmall.taxable)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(gstr3bSummary.b2cSmall.cgst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(gstr3bSummary.b2cSmall.sgst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(gstr3bSummary.b2cSmall.igst)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(gstr3bSummary.b2cSmall.totalTax)}</td>
                </tr>
                <tr>
                  <td><strong>B2C Large Invoices (Table 5)</strong></td>
                  <td style={{ textAlign: 'right' }}>{data.b2c_large.length}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(gstr3bSummary.b2cLarge.taxable)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(gstr3bSummary.b2cLarge.cgst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(gstr3bSummary.b2cLarge.sgst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(gstr3bSummary.b2cLarge.igst)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(gstr3bSummary.b2cLarge.totalTax)}</td>
                </tr>
                <tr style={{ color: '#f87171' }}>
                  <td><strong>Less: Credit / Debit Notes (Table 9B)</strong></td>
                  <td style={{ textAlign: 'right' }}>{data.credit_notes.length}</td>
                  <td style={{ textAlign: 'right' }}>-{formatCurrency(gstr3bSummary.returns.taxable)}</td>
                  <td style={{ textAlign: 'right' }}>-{formatCurrency(gstr3bSummary.returns.cgst)}</td>
                  <td style={{ textAlign: 'right' }}>-{formatCurrency(gstr3bSummary.returns.sgst)}</td>
                  <td style={{ textAlign: 'right' }}>-{formatCurrency(gstr3bSummary.returns.igst)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>-{formatCurrency(gstr3bSummary.returns.totalTax)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(56, 189, 248, 0.1)', fontWeight: 700, borderTop: '2px solid #38bdf8' }}>
                  <td>NET GSTR-3B ELIGIBLE OUTWARD SUPPLY</td>
                  <td style={{ textAlign: 'right' }}>{data.raw.length}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(gstr3bSummary.net.taxable)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(gstr3bSummary.net.cgst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(gstr3bSummary.net.sgst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(gstr3bSummary.net.igst)}</td>
                  <td style={{ textAlign: 'right', color: '#38bdf8' }}>{formatCurrency(gstr3bSummary.net.totalTax)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : activeItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px' }}>
            No records found for {SCHEDULE_TABS.find((t) => t.id === activeTab)?.label} in this period.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="returns-table" style={{ width: '100%', minWidth: '950px' }}>
              <thead>
                <tr>
                  <th>Invoice / Return No</th>
                  <th>Date</th>
                  <th>Customer Name</th>
                  <th>Customer GSTIN</th>
                  <th>Place of Supply</th>
                  <th style={{ textAlign: 'right' }}>Taxable Amount (₹)</th>
                  <th style={{ textAlign: 'right' }}>CGST (₹)</th>
                  <th style={{ textAlign: 'right' }}>SGST (₹)</th>
                  <th style={{ textAlign: 'right' }}>IGST (₹)</th>
                  <th style={{ textAlign: 'right' }}>Total Tax (₹)</th>
                  <th style={{ textAlign: 'right' }}>Invoice Value (₹)</th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map((item, idx) => (
                  <tr key={item.id || item.billId || idx}>
                    <td><strong>{item.orderNumber || item.order_number || item.billId}</strong></td>
                    <td>{item.date ? String(item.date).slice(0, 10) : '-'}</td>
                    <td>{item.customerName || item.customer_name || 'Retail Customer'}</td>
                    <td>
                      {item.customerGstin || item.customer_gstin ? (
                        <span className="badge-flag">{item.customerGstin || item.customer_gstin}</span>
                      ) : (
                        <span style={{ color: '#64748b' }}>Unregistered</span>
                      )}
                    </td>
                    <td>{item.placeOfSupply || item.place_of_supply || 'Intra-State'}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.taxableAmount || item.taxable_amount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.cgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.sgst)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.igst)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.totalTax || item.total_tax)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.invoiceTotal || item.invoice_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(15, 23, 42, 0.4)', fontWeight: 700, borderTop: '2px solid rgba(148, 163, 184, 0.3)' }}>
                  <td colSpan={5}>SCHEDULE TOTALS ({formatNumber(activeItems.length)} Records)</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(activeTotals.taxable)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(activeTotals.cgst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(activeTotals.sgst)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(activeTotals.igst)}</td>
                  <td style={{ textAlign: 'right', color: '#38bdf8' }}>{formatCurrency(activeTotals.totalTax)}</td>
                  <td style={{ textAlign: 'right', color: '#4ade80' }}>{formatCurrency(activeTotals.invoiceTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default GstFilingData;
