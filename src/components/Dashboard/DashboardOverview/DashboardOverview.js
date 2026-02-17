import React from "react";
import StatBox from "../../common/StatBox/StatBox";
import TableComponent from "../../common/TableComponent/TableComponent";
import { useState, useEffect } from "react";
import "./DashboardOverview.css";
import api from "../../../utils/axios";
import LoadingSpinner from "../../common/LoadingSpinner/LoadingSpinner";
import { usePopup } from "../../common/PopUp/PopupProvider";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);



const DashboardOverview = ({navigate}) => {
  const sellingColumns = ["Name", "Company","Profit", "NoOfSold"];
  const profitColumns = ["Name", "Price", "Company", "NoOfSold"];
  const stockColumns = ["ProductId","Name", "ActualPrice", "Seller","Quantity", "TimeForDelivery"];
  const [isLoading, setIsLoading] = useState(true);
  const [todayStats, setTodayStats] = useState({});
  const [lastMonthStats, setLastMonthStats] = useState({});
  const [mostSellingTable, setMostSellingTable] = useState([]);
  const [profitByProductTable, setProfitByProduct] = useState([]);
  const [inventoryData, setInventoryData] = useState({});
  const [profitRange, setProfitRange] = useState(30);
  const [profitLabels, setProfitLabels] = useState([]);
  const [profitData, setProfitData] = useState([]);
  const [profitLoading, setProfitLoading] = useState(false);
  const [serverOffline, setServerOffline] = useState(false);
  const tableMaxHeight = "320px";
  const { showPopup } = usePopup();

  const isNetworkError = (err) =>
    !err?.response ||
    err?.code === "ERR_NETWORK" ||
    (typeof err?.message === "string" && err.message.toLowerCase().includes("network"));

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [daily, monthly, inventory] = await Promise.all([
          api.get(`/reports/daily`).then(res => res.data),
          api.get(`/reports/sales`).then(res => res.data),
          api.get(`/reports/inventory`).then(res => res.data)
        ]);
  
        setServerOffline(false);
        if(!daily.message)
        setTodayStats({
          revenue: daily.total_revenue,
          profit: daily.profit,
          orders: daily.total_orders
        });
        if(!monthly.message)
        setLastMonthStats({
          revenue: monthly.total_revenue,
          profit: monthly.totalProfit,
          orders: monthly.total_orders
        });
  
        setMostSellingTable(monthly.bestSellingProducts);
        setProfitByProduct(monthly.profitByProduct);
  
        setInventoryData({
          totalStock: inventory.total_stock,
          lowStockProducts: inventory.low_stock_products,
          outOfStockProducts: inventory.out_of_stock_products,
          totalValue: inventory.total_inventory_value,
          actualValue: inventory.total_inventory_actual_value,
          estimatedProfit: inventory.estimatedProfit
        });
      } catch (err) {
        if (isNetworkError(err)) {
          setServerOffline(true);
          return;
        }
        if (
          err?.response?.data?.message === "Invalid Token" ||
          err?.response?.status === 400 ||
          err?.response?.status == 401 ||
          err?.response?.status === 403
        ){
          showPopup("Token Expired Please Login Again!!", "Session");
          navigate('/');
        }
        console.log(err);
      } finally {
        setIsLoading(false);
      }
    };
  
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const fetchProfitGraph = async () => {
      setProfitLoading(true);
      try {
        const res = await api.get(`/reports/profit-graph?range=${profitRange}`);
        setServerOffline(false);
        setProfitLabels(res.data?.labels || []);
        setProfitData(res.data?.data || []);
      } catch (err) {
        if (isNetworkError(err)) {
          setServerOffline(true);
        }
        console.error("Profit graph error", err);
      } finally {
        setProfitLoading(false);
      }
    };
    fetchProfitGraph();
  }, [profitRange]);

  const profitIsEmpty = profitData.length === 0 || profitData.every((v) => v === 0);

  const profitChartData = {
    labels: profitLabels,
    datasets: [
      {
        label: "Profit",
        data: profitData,
        borderColor: "#38bdf8",
        backgroundColor: "rgba(56, 189, 248, 0.15)",
        tension: 0.35,
        fill: true,
        pointRadius: 2,
      },
    ],
  };

  const profitChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#e2e8f0" } },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148, 163, 184, 0.15)" } },
      y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148, 163, 184, 0.15)" } },
    },
  };


  return (
    <div className="dashboard">
      {/* <div className="floating-shape circle red"></div>
      <div className="floating-shape triangle purple"></div>
      <div className="floating-shape square yellow"></div>
      <div className="floating-shape wave pink"></div>
      <div className="floating-shape ring orange"></div>
      <div className="floating-shape cube green"></div>
      <div className="floating-shape logincube green"></div>
      <div className="floating-shape logincircle red"></div> */}
     {/* Navbar */}
    {
         isLoading ?
         <LoadingSpinner />
        :
    
<>
    { 
    
      <div className="stat-row">
        {todayStats.revenue >=0 && <StatBox label="Today's Revenue" value={todayStats.revenue || 0} />}
        {todayStats.profit >=0 && <StatBox label="Today's Profit" value={todayStats.profit || 0} />}
        {todayStats.orders >=0 && <StatBox label="Today's Orders" value={todayStats.orders || 0} /> }
        {lastMonthStats.revenue >=0 && <StatBox label="Last Month Revenue" value={lastMonthStats.revenue || 0} />}
        {lastMonthStats.profit >=0 && <StatBox label="Last Month Profit" value={lastMonthStats.profit || 0} />}
        {lastMonthStats.orders >=0 &&<StatBox label="Last Month Orders" value={lastMonthStats.orders || 0} />}
      </div>}

      {/* <div className="stat-row">
        <StatBox label="Last Month Revenue" value={lastMonthStats.revenue || 0} />
        <StatBox label="Last Month Profit" value={lastMonthStats.profit || 0} />
        <StatBox label="Last Month Orders" value={lastMonthStats.orders || 0} />
      </div> */}

      <div className="tables-section row">
        {mostSellingTable &&mostSellingTable.length >0 && (
          <TableComponent
            title="Most Selling Products"
            columns={sellingColumns}
            data={mostSellingTable}
            maxHeight={tableMaxHeight}
          />
        )}
        {profitByProductTable && profitByProductTable.length > 0 && (
          <TableComponent
            title="Most Profitable Products"
            columns={profitColumns}
            data={profitByProductTable}
            maxHeight={tableMaxHeight}
          />
        )}
        {inventoryData.outOfStockProducts && inventoryData.outOfStockProducts.length > 0 && (
          <TableComponent
            color='red'
            title="Out of Stock Products"
            columns={stockColumns}
            data={inventoryData.outOfStockProducts}
            maxHeight={tableMaxHeight}
          />
        )}
        {inventoryData.lowStockProducts && inventoryData.lowStockProducts.length > 0 && (
          <TableComponent
            color='orange'
            title="Low on Stock"
            columns={stockColumns}
            data={inventoryData.lowStockProducts}
            maxHeight={tableMaxHeight}
          />
        )}
      </div>

      <div className="profit-graph-card p-5 mb-5">
        <div className="profit-graph-header">
          <h4>Profit Trend</h4>
          <div className="profit-toggle">
            <button
              className={`btn btn-outline-primary ${profitRange === 30 ? 'active' : ''}`}
              onClick={() => setProfitRange(30)}
            >
              Last 30 Days
            </button>
            <button
              className={`btn btn-outline-primary ${profitRange === 365 ? 'active' : ''}`}
              onClick={() => setProfitRange(365)}
            >
              Last 365 Days
            </button>
          </div>
        </div>
        <div className="profit-graph-body">
          {profitLoading ? (
            <div className="profit-empty">Loading profit graph...</div>
          ) : profitIsEmpty ? (
            <div className="profit-empty">No profit data for this range.</div>
          ) : (
            <Line data={profitChartData} options={profitChartOptions} />
          )}
        </div>
      </div>


      <div className="summary-row">
        <StatBox label="Total Products" value={inventoryData.totalStock} />
        {inventoryData.totalValue && <StatBox label="Cost of Stock" value={inventoryData.totalValue} />}
        {inventoryData.estimatedProfit && <StatBox label="Estimated Profit" value={inventoryData.estimatedProfit}/>}
      </div>

      </>
}
      
</div>
  );
};

export default DashboardOverview;
