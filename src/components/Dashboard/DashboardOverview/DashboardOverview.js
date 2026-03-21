import React, { useEffect, useMemo, useRef, useState } from "react";
import "./DashboardOverview.css";
import api from "../../../utils/axios";
import { preloadProductsToIndexedDb } from "../../../utils/indexedDb";
import LoadingSpinner from "../../common/LoadingSpinner/LoadingSpinner";
import { usePopup } from "../../common/PopUp/PopupProvider";
import { Line, Pie } from "react-chartjs-2";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

const RANGE_OPTIONS = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "this_week" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 30 Days", value: "last_30_days" },
];

const formatValue = (value, format) => {
  if (value === null || value === undefined) return "-";
  if (format === "currency") {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return value;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  }
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 2,
    }).format(value);
  }
  return value;
};

const DashboardOverview = ({ navigate }) => {
  const sidebarRef = useRef(null);
  const preloadRef = useRef(false);
  const location = useLocation();
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const userDetails = useSelector((state) => state.user.userDetails);
  const planFeatures = tenantConfig?.plan_features || tenantConfig || {};
  const advancedEnabled = planFeatures.advanced_reports === true;
  const analyticalEnabled = planFeatures.analytical_reports === true;
  const isStaff = userDetails?.role === "staff";
  const [range, setRange] = useState("this_month");
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [salesTrendMode, setSalesTrendMode] = useState("overall");
  const [overview, setOverview] = useState(null);
  const [basicOverview, setBasicOverview] = useState(null);
  const [growthData, setGrowthData] = useState(null);
  const [salesTrend, setSalesTrend] = useState(null);
  const [locationPerformance, setLocationPerformance] = useState(null);
  const [categoryData, setCategoryData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
  const [customerCredit, setCustomerCredit] = useState(null);
  const [smartInsights, setSmartInsights] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isFetchingBasic, setIsFetchingBasic] = useState(false);
  const [isFetchingGrowth, setIsFetchingGrowth] = useState(false);
  const [isFetchingSalesTrend, setIsFetchingSalesTrend] = useState(false);
  const [isFetchingCategory, setIsFetchingCategory] = useState(false);
  const [isFetchingInventory, setIsFetchingInventory] = useState(false);
  const [isFetchingCustomerCredit, setIsFetchingCustomerCredit] = useState(false);
  const [isFetchingInsights, setIsFetchingInsights] = useState(false);
  const [isFetchingLocationPerf, setIsFetchingLocationPerf] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [activeProductsTab, setActiveProductsTab] = useState("quantity");
  const { showPopup } = usePopup();

  useEffect(() => {
    if (isStaff && activeSection !== "overview") {
      setActiveSection("overview");
    }
  }, [isStaff, activeSection]);

  useEffect(() => {
    if (preloadRef.current) return;
    preloadRef.current = true;
    preloadProductsToIndexedDb().catch((err) => {
      console.error('IndexedDB preload failed', err);
    });
  }, []);

  useEffect(() => {
    setIsFetching(false);
    setIsFetchingGrowth(false);
    setIsFetchingSalesTrend(false);
    setIsFetchingCategory(false);
    setIsFetchingInventory(false);
    setIsFetchingCustomerCredit(false);
    setIsFetchingInsights(false);
    setIsFetchingLocationPerf(false);
  }, [activeSection]);

  const isNetworkError = (err) =>
    !err?.response ||
    err?.code === "ERR_NETWORK" ||
    (typeof err?.message === "string" &&
    err.message.toLowerCase().includes("network"));

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  useEffect(() => {
    if (activeSection !== "revenue-overview" || !advancedEnabled) {
      setIsLoading(false);
      return;
    }
    let isMounted = true;
    const fetchOverview = async () => {
      setIsFetching(true);
      try {
        const query = new URLSearchParams({
          range,
          ...(selectedLocation ? { location: selectedLocation } : {}),
        });
        const res = await api.get(
          `/dashboard/revenue-overview?${query.toString()}`
        );
        if (!isMounted) return;
        const payload = res?.data?.data || res?.data || {};
        setOverview(payload);
      } catch (err) {
        if (isNetworkError(err)) {
          showPopup("Network error. Please check your connection.", "Network");
          return;
        }
        if (
          err?.response?.data?.message === "Invalid Token" ||
          err?.response?.status === 401 
        ) {
          showPopup("Token Expired Please Login Again!!", "Session");
          navigate("/");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsFetching(false);
        }
      }
    };

    fetchOverview();
    return () => {
      isMounted = false;
    };
  }, [activeSection, advancedEnabled, range, selectedLocation, navigate, showPopup]);

  useEffect(() => {
    let isMounted = true;
    const fetchBasicOverview = async () => {
      setIsFetchingBasic(true);
      try {
        const query = new URLSearchParams({
          range,
          ...(selectedLocation ? { location: selectedLocation } : {}),
        });
        const res = await api.get(`/dashboard?${query.toString()}`);
        if (!isMounted) return;
        const payload = res?.data?.data || res?.data || {};
        setBasicOverview(payload);
      } catch (err) {
        if (isNetworkError(err)) {
          showPopup("Network error. Please check your connection.", "Network");
          return;
        }
        if (
          err?.response?.data?.message === "Invalid Token" ||
          err?.response?.status === 401
        ) {
          showPopup("Token Expired Please Login Again!!", "Session");
          navigate("/");
        }
      } finally {
        if (isMounted) {
          setIsFetchingBasic(false);
        }
      }
    };

    fetchBasicOverview();
    return () => {
      isMounted = false;
    };
  }, [range, selectedLocation, navigate, showPopup]);

  useEffect(() => {
    let isMounted = true;
    const fetchLocations = async () => {
      try {
        const res = await api.get('/dashboard/locations-list');
        const payload = res?.data?.data ?? res?.data ?? [];
        const list = Array.isArray(payload)
          ? payload
          : payload?.locations || payload?.data || [];
        if (!isMounted) return;
        setLocations(list);
      } catch (err) {
        if (!isMounted) return;
        setLocations([]);
      }
    };
    fetchLocations();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeSection !== "growth-comparison" || !advancedEnabled) return;
    let isMounted = true;
    const fetchGrowth = async () => {
      setIsFetchingGrowth(true);
      try {
        const query = new URLSearchParams({
          range,
          ...(selectedLocation ? { location: selectedLocation } : {}),
        });
        const res = await api.get(
          `/dashboard/growth-comparison?${query.toString()}`
        );
        if (!isMounted) return;
        const payload = res?.data?.data || res?.data || {};
        setGrowthData(payload);
      } catch (err) {
        if (isNetworkError(err)) {
          showPopup("Network error. Please check your connection.", "Network");
          return;
        }
        if (
          err?.response?.data?.message === "Invalid Token" ||
          err?.response?.status === 401
        ) {
          showPopup("Token Expired Please Login Again!!", "Session");
          navigate("/");
        }
      } finally {
        if (isMounted) {
          setIsFetchingGrowth(false);
        }
      }
    };

    fetchGrowth();
    return () => {
      isMounted = false;
    };
  }, [activeSection, advancedEnabled, range, selectedLocation, navigate, showPopup]);

  useEffect(() => {
    if (activeSection !== "inventory-intelligence" || !analyticalEnabled) return;
    let isMounted = true;
    const fetchInventory = async () => {
      setIsFetchingInventory(true);
      try {
        const query = new URLSearchParams({
          range,
          ...(selectedLocation ? { location: selectedLocation } : {}),
        });
        const res = await api.get(
          `/dashboard/inventory-intelligence?${query.toString()}`
        );
        if (!isMounted) return;
        const payload = res?.data?.data || res?.data || {};
        setInventoryData(payload);
      } catch (err) {
        if (isNetworkError(err)) {
          showPopup("Network error. Please check your connection.", "Network");
          return;
        }
        if (
          err?.response?.data?.message === "Invalid Token" ||
          err?.response?.status === 401
        ) { 
          showPopup("Token Expired Please Login Again!!", "Session");
          navigate("/");
        }
      } finally {
        if (isMounted) {
          setIsFetchingInventory(false);
        }
      }
    };

    fetchInventory();
    return () => {
      isMounted = false;
    };
  }, [activeSection, analyticalEnabled, range, selectedLocation, navigate, showPopup]);

  useEffect(() => {
    if (activeSection !== "customer-credit" || !analyticalEnabled) return;
    let isMounted = true;
    const fetchCustomerCredit = async () => {
      setIsFetchingCustomerCredit(true);
      try {
        const query = new URLSearchParams({
          range,
          ...(selectedLocation ? { location: selectedLocation } : {}),
        });
        const res = await api.get(
          `/dashboard/customer-credit?${query.toString()}`
        );
        if (!isMounted) return;
        const payload = res?.data?.data || res?.data || {};
        setCustomerCredit(payload);
      } catch (err) {
        if (isNetworkError(err)) {
          showPopup("Network error. Please check your connection.", "Network");
          return;
        }
        if (
          err?.response?.data?.message === "Invalid Token" ||
          err?.response?.status === 401
        ) {
          showPopup("Token Expired Please Login Again!!", "Session");
          navigate("/");
        }
      } finally {
        if (isMounted) {
          setIsFetchingCustomerCredit(false);
        }
      }
    };

    fetchCustomerCredit();
    return () => {
      isMounted = false;
    };
  }, [activeSection, analyticalEnabled, range, selectedLocation, navigate, showPopup]);

  useEffect(() => {
    if (activeSection !== "smart-insights" || !analyticalEnabled) return;
    let isMounted = true;
    const fetchInsights = async () => {
      setIsFetchingInsights(true);
      try {
        const query = new URLSearchParams({
          range,
          ...(selectedLocation ? { location: selectedLocation } : {}),
        });
        const res = await api.get(
          `/dashboard/smart-insights?${query.toString()}`
        );
        if (!isMounted) return;
        const payload = res?.data?.data || res?.data || {};
        setSmartInsights(payload);
      } catch (err) {
        if (isNetworkError(err)) {
          showPopup("Network error. Please check your connection.", "Network");
          return;
        }
        if (
          err?.response?.data?.message === "Invalid Token" ||
          err?.response?.status === 401
        ) {
          showPopup("Token Expired Please Login Again!!", "Session");
          navigate("/");
        }
      } finally {
        if (isMounted) {
          setIsFetchingInsights(false);
        }
      }
    };

    fetchInsights();
    return () => {
      isMounted = false;
    };
  }, [activeSection, analyticalEnabled, range, selectedLocation, navigate, showPopup]);

  useEffect(() => {
    if (activeSection !== "sales-trend" || !advancedEnabled) return;
    let isMounted = true;
    const fetchSalesTrend = async () => {
      setIsFetchingSalesTrend(true);
      try {
        const query = new URLSearchParams({
          range,
          ...(salesTrendMode === 'location' ? { group_by: 'location' } : {}),
          ...(selectedLocation ? { location: selectedLocation } : {}),
        });
        const res = await api.get(
          `/dashboard/sales-trend?${query.toString()}`
        );
        if (!isMounted) return;
        const payload = res?.data?.data || res?.data || {};
        setSalesTrend(payload);
      } catch (err) {
        if (isNetworkError(err)) {
          showPopup("Network error. Please check your connection.", "Network");
          return;
        }
        if (
          err?.response?.data?.message === "Invalid Token" ||
          err?.response?.status === 401
        ) {
          showPopup("Token Expired Please Login Again!!", "Session");
          navigate("/");
        }
      } finally {
        if (isMounted) {
          setIsFetchingSalesTrend(false);
        }
      }
    };

    fetchSalesTrend();
    return () => {
      isMounted = false;
    };
  }, [activeSection, advancedEnabled, range, selectedLocation, salesTrendMode, navigate, showPopup]);

  useEffect(() => {
    if (activeSection !== "category-products" || !advancedEnabled) return;
    let isMounted = true;
    const fetchCategoryPerformance = async () => {
      setIsFetchingCategory(true);
      try {
        const query = new URLSearchParams({
          range,
          ...(selectedLocation ? { location: selectedLocation } : {}),
        });
        const res = await api.get(
          `/dashboard/category-performance?${query.toString()}`
        );
        if (!isMounted) return;
        const payload = res?.data?.data || res?.data || {};
        setCategoryData(payload);
      } catch (err) {
        if (isNetworkError(err)) {
          showPopup("Network error. Please check your connection.", "Network");
          return;
        }
        if (
          err?.response?.data?.message === "Invalid Token" ||
          err?.response?.status === 401
        ) {
          showPopup("Token Expired Please Login Again!!", "Session");
          navigate("/");
        }
      } finally {
        if (isMounted) {
          setIsFetchingCategory(false);
        }
      }
    };

    fetchCategoryPerformance();
    return () => {
      isMounted = false;
    };
  }, [activeSection, advancedEnabled, range, selectedLocation, navigate, showPopup]);

  useEffect(() => {
    if (activeSection !== "location-performance") return;
    let isMounted = true;
    const fetchLocationPerformance = async () => {
      setIsFetchingLocationPerf(true);
      try {
        const query = new URLSearchParams({
          range,
          ...(selectedLocation ? { location: selectedLocation } : {}),
        });
        const res = await api.get(
          `/dashboard/location-performance?${query.toString()}`
        );
        if (!isMounted) return;
        const payload = res?.data?.data || res?.data || {};
        setLocationPerformance(payload);
      } catch (err) {
        if (!isMounted) return;
        setLocationPerformance(null);
      } finally {
        if (isMounted) {
          setIsFetchingLocationPerf(false);
        }
      }
    };

    fetchLocationPerformance();
    return () => {
      isMounted = false;
    };
  }, [activeSection, range, selectedLocation]);

  const advancedSections = [
    "revenue-overview",
    "growth-comparison",
    "sales-trend",
    "category-products",
  ];
  const analyticalSections = [
    "inventory-intelligence",
    "customer-credit",
    "smart-insights",
  ];

  const lockedPlan =
    advancedSections.includes(activeSection) && !advancedEnabled
      ? "Pro"
      : analyticalSections.includes(activeSection) && !analyticalEnabled
      ? "Premium"
      : null;


  const revenueCards = useMemo(() => {
    const source = overview?.revenue_overview || {};
    return [
      {
        label: "Total Revenue",
        value: source.total_revenue,
        format: "currency",
        icon: "bi bi-cash-stack",
      },
      {
        label: "Total Profit",
        value: source.total_profit,
        format: "currency",
        icon: "bi bi-graph-up",
      },
      {
        label: "Total Orders",
        value: source.total_orders,
        format: "number",
        icon: "bi bi-bag-check",
      },
      {
        label: "Avg Order Value",
        value: source.avg_order_value,
        format: "currency",
        icon: "bi bi-receipt",
      },
    ];
  }, [overview]);

  const basicCards = useMemo(() => {
    const products = basicOverview?.products || {};
    const orders = basicOverview?.orders || {};
    const revenue = basicOverview?.revenue || {};
    const cards = [
      {
        label: "Total Products",
        value: products.total,
        format: "number",
        icon: "bi bi-box-seam",
      },
      {
        label: "Low Stock Items",
        value: products.low_stock,
        format: "number",
        icon: "bi bi-exclamation-triangle",
      },
      {
        label: "Total Orders",
        value: orders.total,
        format: "number",
        icon: "bi bi-bag-check",
      },
      {
        label: "Pending Orders",
        value: orders.pending,
        format: "number",
        icon: "bi bi-hourglass-split",
      },
      {
        label: "Completed Orders",
        value: orders.completed,
        format: "number",
        icon: "bi bi-check-circle",
      },
      {
        label: "Total Revenue",
        value: revenue.total,
        format: "currency",
        icon: "bi bi-cash-stack",
      },
    ];
    return isStaff ? cards.filter((card) => card.label !== "Total Revenue") : cards;
  }, [basicOverview, isStaff]);

  const growthCards = useMemo(() => {
    const current = growthData?.current_period || {};
    const growth = growthData?.growth || {};
    return [
      {
        label: "Revenue Growth",
        value: current.revenue,
        format: "currency",
        percent: growth.revenue_growth_percent,
      },
      {
        label: "Profit Growth",
        value: current.profit,
        format: "currency",
        percent: growth.profit_growth_percent,
      },
      {
        label: "Orders Growth",
        value: current.orders,
        format: "number",
        percent: growth.orders_growth_percent ?? growth.order_growth_percent,
      },
    ];
  }, [growthData]);

  const getGrowthMeta = (percent) => {
    const numeric =
      percent === null || percent === undefined ? null : Number(percent);
    if (!Number.isFinite(numeric)) {
      return { direction: "flat", display: "--" };
    }
    if (numeric > 0) {
      return { direction: "up", display: `+${numeric.toFixed(2)}%` };
    }
    if (numeric < 0) {
      return { direction: "down", display: `${numeric.toFixed(2)}%` };
    }
    return { direction: "flat", display: "0.00%" };
  };

  const salesTrendLabels = useMemo(() => {
    if (salesTrendMode === 'location') {
      const series = salesTrend?.series || salesTrend?.data || [];
      const first = series?.[0]?.data || [];
      return first.map((item) => item?.label);
    }
    return (salesTrend?.data || []).map((item) => item?.label);
  }, [salesTrend, salesTrendMode]);

  const salesTrendDatasets = useMemo(() => {
    if (salesTrendMode === 'location') {
      const palette = ["#38bdf8", "#f472b6", "#fbbf24", "#4ade80", "#a78bfa", "#fb7185"];
      const series = salesTrend?.series || salesTrend?.data || [];
      return series.map((entry, idx) => ({
        label: entry?.location || entry?.label || `City ${idx + 1}`,
        data: (entry?.data || []).map((item) => item?.revenue),
        borderColor: palette[idx % palette.length],
        backgroundColor: "rgba(56, 189, 248, 0.12)",
        tension: 0.35,
        fill: false,
        pointRadius: 2,
      }));
    }
    return [
      {
        label: "Revenue",
        data: (salesTrend?.data || []).map((item) => item?.revenue),
        borderColor: "#38bdf8",
        backgroundColor: "rgba(56, 189, 248, 0.18)",
        tension: 0.4,
        fill: true,
        pointRadius: 2,
      },
    ];
  }, [salesTrend, salesTrendMode]);

  const salesTrendChartData = useMemo(
    () => ({
      labels: salesTrendLabels,
      datasets: salesTrendDatasets,
    }),
    [salesTrendLabels, salesTrendDatasets]
  );

  const salesTrendChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: { labels: { color: "#e2e8f0" } },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            title: (items) => items?.[0]?.label || "",
            label: (context) => {
              const value = context?.raw;
              return `Revenue: ${formatValue(value, "currency")}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(148, 163, 184, 0.12)" },
        },
        y: {
          ticks: {
            color: "#94a3b8",
            callback: (value) => formatValue(value, "currency"),
          },
          grid: { color: "rgba(148, 163, 184, 0.12)" },
        },
      },
    }),
    []
  );

  const categoryItems = useMemo(
    () => categoryData?.category_performance || [],
    [categoryData]
  );
  const topByQuantity = useMemo(
    () => categoryData?.top_products_by_quantity || [],
    [categoryData]
  );
  const topByRevenue = useMemo(
    () => categoryData?.top_products_by_revenue || [],
    [categoryData]
  );

  const categoryChartData = useMemo(
    () => ({
      labels: categoryItems.map((item) => item?.category_name),
      datasets: [
        {
          data: categoryItems.map((item) => item?.revenue),
          backgroundColor: [
            "#38bdf8",
            "#f472b6",
            "#fbbf24",
            "#4ade80",
            "#a78bfa",
            "#fb7185",
          ],
          borderWidth: 0,
        },
      ],
    }),
    [categoryItems]
  );

  const categoryChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#e2e8f0" } },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context?.raw;
              return `Revenue: ${formatValue(value, "currency")}`;
            },
          },
        },
      },
    }),
    []
  );

  const inventorySummary = inventoryData?.inventory_summary || {};
  const lowStockRows = inventoryData?.low_stock || [];
  const deadStockRows = inventoryData?.dead_stock || [];
  const fastMovingRows = inventoryData?.fast_moving || [];
  const topCustomers = customerCredit?.top_customers || [];
  const creditSummary = customerCredit?.credit_summary || {};
  const customerMetrics = customerCredit?.customer_metrics || {};
  const insights = smartInsights?.insights || [];
  const locationPerfRows = locationPerformance?.locations || locationPerformance?.data || [];
  const locationOptions = useMemo(() => {
    const apiList = Array.isArray(locations)
      ? locations.map((loc) => loc?.name || loc?.location || loc)
      : [];
    return Array.from(new Set(apiList)).filter(Boolean);
  }, [locations]);

  useEffect(() => {
    if (sidebarRef.current) {
      sidebarRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeSection]);

  const getInsightIcon = (type) => {
    const normalized = String(type || "").toLowerCase();
    if (normalized.includes("growth")) return "bi bi-graph-up";
    if (normalized.includes("dead")) return "bi bi-box-seam";
    if (normalized.includes("credit")) return "bi bi-credit-card";
    if (normalized.includes("profit")) return "bi bi-cash-stack";
    if (normalized.includes("fast")) return "bi bi-lightning-charge";
    return "bi bi-stars";
  };

  if (isLoading) {
    return (
      <div className="dashboard-v2">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="dashboard-v2">
      <aside className="dashboard-sidebar" ref={sidebarRef}>
        <nav className="sidebar-nav">
            <button
              type="button"
              className={
                activeSection === "overview" ? "active" : ""
              }
              onClick={() => setActiveSection("overview")}
            >
              Overview
            </button>
            {!isStaff && (
              <>
            <button
              type="button"
              className={
                `${activeSection === "revenue-overview" ? "active" : ""}${
                  !advancedEnabled ? " locked" : ""
                }`
            }
            onClick={() => setActiveSection("revenue-overview")}
          >
            Revenue Overview
            {!advancedEnabled && <span className="lock-tag">PRO</span>}
          </button>
          <button
            type="button"
            className={
              `${activeSection === "growth-comparison" ? "active" : ""}${
                !advancedEnabled ? " locked" : ""
              }`
            }
            onClick={() => setActiveSection("growth-comparison")}
          >
            Growth & Comparison
            {!advancedEnabled && <span className="lock-tag">PRO</span>}
          </button>
          <button
            type="button"
            className={
              `${activeSection === "sales-trend" ? "active" : ""}${
                !advancedEnabled ? " locked" : ""
              }`
            }
            onClick={() => setActiveSection("sales-trend")}
          >
            Sales Trend
            {!advancedEnabled && <span className="lock-tag">PRO</span>}
          </button>
          <button
            type="button"
            className={
              `${activeSection === "category-products" ? "active" : ""}${
                !advancedEnabled ? " locked" : ""
              }`
            }
            onClick={() => setActiveSection("category-products")}
          >
            Category & Top Products
            {!advancedEnabled && <span className="lock-tag">PRO</span>}
          </button>
          <button
            type="button"
            className={activeSection === "location-performance" ? "active" : ""}
            onClick={() => setActiveSection("location-performance")}
          >
            Location Performance
          </button>
          <button
            type="button"
            className={
              `${activeSection === "inventory-intelligence" ? "active" : ""}${
                !analyticalEnabled ? " locked" : ""
              }`
            }
            onClick={() => setActiveSection("inventory-intelligence")}
          >
            Inventory Intelligence
            {!analyticalEnabled && <span className="lock-tag">PREMIUM</span>}
          </button>
          <button
            type="button"
            className={
              `${activeSection === "customer-credit" ? "active" : ""}${
                !analyticalEnabled ? " locked" : ""
              }`
            }
            onClick={() => setActiveSection("customer-credit")}
          >
            Customer & Credit
            {!analyticalEnabled && <span className="lock-tag">PREMIUM</span>}
          </button>
          <button
            type="button"
              className={
                `${activeSection === "smart-insights" ? "active" : ""}${
                  !analyticalEnabled ? " locked" : ""
                }`
              }
              onClick={() => setActiveSection("smart-insights")}
            >
              Smart Insights
              {!analyticalEnabled && <span className="lock-tag">PREMIUM</span>}
            </button>
              </>
            )}
            <button
              type="button"
              className="support-link"
              onClick={() => {
              navigate('/support');
            }}
          >
            Contact Support
          </button>
        </nav>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">
              {activeSection === "overview"
                ? "Overview"
                : activeSection === "growth-comparison"
                ? "Growth & Comparison"
                : activeSection === "sales-trend"
                ? "Sales Trend"
                : activeSection === "category-products"
                ? "Category & Top Products"
                : activeSection === "location-performance"
                ? "Location Performance"
                : activeSection === "inventory-intelligence"
                ? "Inventory Intelligence"
                : activeSection === "customer-credit"
                ? "Customer & Credit"
                : activeSection === "smart-insights"
                ? "Smart Insights"
                : "Revenue Overview"}
            </p>
            <h1>
              {activeSection === "overview"
                ? "Overview"
                : activeSection === "growth-comparison"
                ? "Growth & Comparison"
                : activeSection === "sales-trend"
                ? "Sales Trend"
                : activeSection === "category-products"
                ? "Category & Top Products"
                : activeSection === "location-performance"
                ? "Location Performance"
                : activeSection === "inventory-intelligence"
                ? "Inventory Intelligence"
                : activeSection === "customer-credit"
                ? "Customer & Credit"
                : activeSection === "smart-insights"
                ? "Smart Insights"
                : "Revenue Overview"}
            </h1>
          </div>
          <div className="filters-row">
            <div className="range-filter">
              <label htmlFor="range-select">Range</label>
              <select
                id="range-select"
                value={range}
                onChange={(event) => setRange(event.target.value)}
                disabled={
                  isFetching ||
                  isFetchingGrowth ||
                  isFetchingSalesTrend ||
                  isFetchingCategory ||
                  isFetchingInventory ||
                  isFetchingCustomerCredit ||
                  isFetchingInsights
                }
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="range-filter">
              <label htmlFor="location-select">Location</label>
              <select
                id="location-select"
                value={selectedLocation}
                onChange={(event) => setSelectedLocation(event.target.value)}
              >
                <option value="">All Locations</option>
                {locationOptions.map((value, idx) => (
                  <option key={`loc-${idx}`} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {lockedPlan && (
          <section className="dash-section">
            <div className="upgrade-card">
              <h2>Unlock {activeSection.replace("-", " ")}</h2>
              <p>These metrics are available on the {lockedPlan} plan.</p>
              <div className="upgrade-meta">
                Upgrade your plan to access this dashboard.
              </div>
            </div>
          </section>
        )}

        {!lockedPlan && activeSection === "overview" && (
          <section className="dash-section" id="overview">
            {/* <div className="section-header">
              <p>Snapshot of products, orders, and revenue.</p>
            </div> */}
            <div className="basic-overview-card">
              <div className="basic-overview-header">
                <div>
                  <h3>Overview</h3>
                  <p className="muted">
                    {basicOverview?.date_range?.start_date
                      ? `${formatDate(basicOverview.date_range.start_date)} to ${formatDate(basicOverview.date_range.end_date)}`
                      : "Summary for selected range."}
                  </p>
                </div>
                <span className="range-pill">{basicOverview?.range || range}</span>
              </div>
              <div className="card-grid basic-grid">
                {isFetchingBasic
                  ? Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="stat-card skeleton-card">
                        <div className="skeleton-line short"></div>
                        <div className="skeleton-line long"></div>
                        <div className="skeleton-line medium"></div>
                      </div>
                    ))
                  : basicCards.map((card, index) => (
                      <div key={index} className="stat-card">
                        <div className="stat-icon">
                          <i className={card.icon}></i>
                        </div>
                        <div className="stat-label">{card.label}</div>
                        <div className="stat-value">
                          {formatValue(card.value, card.format)}
                        </div>
                      </div>
                    ))}
                {!isFetchingBasic && basicCards.length === 0 && (
                  <div className="empty-state">No overview data available.</div>
                )}
              </div>
            </div>
          </section>
        )}

        {!isStaff && !lockedPlan && activeSection === "revenue-overview" && (
          <section className="dash-section" id="revenue-overview">
            <div className="section-header">
              {/* <h2>Revenue Overview</h2> */}
              <p>Key metrics for total revenue, profit, and orders.</p>
            </div>
            <div className="card-grid revenue-grid">
              {isFetching
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="stat-card skeleton-card">
                      <div className="skeleton-line short"></div>
                      <div className="skeleton-line long"></div>
                      <div className="skeleton-line medium"></div>
                    </div>
                  ))
                : revenueCards.map((card, index) => (
                    <div key={index} className="stat-card">
                      <div className="stat-icon">
                        {card?.icon ? (
                          <i className={card.icon}></i>
                        ) : (
                          <i className="bi bi-bar-chart"></i>
                        )}
                      </div>
                      <div className="stat-label">{card?.label}</div>
                      <div className="stat-value">
                        {formatValue(card?.value, card?.format)}
                      </div>
                      {card?.subLabel && (
                        <div className="stat-sub">{card.subLabel}</div>
                      )}
                    </div>
                  ))}
              {!isFetching && revenueCards.length === 0 && (
                <div className="empty-state">No revenue data available.</div>
              )}
            </div>
          </section>
        )}

        {!isStaff && !lockedPlan && activeSection === "growth-comparison" && (
          <section className="dash-section" id="growth-comparison">
            <div className="section-header">
              <p>Performance compared to the previous period.</p>
              {selectedLocation && (
                <span className="filter-chip">Filtered by: {selectedLocation}</span>
              )}
            </div>
            <div className="card-grid revenue-grid">
              {isFetchingGrowth
                ? Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="stat-card skeleton-card">
                      <div className="skeleton-line short"></div>
                      <div className="skeleton-line long"></div>
                      <div className="skeleton-line medium"></div>
                    </div>
                  ))
                : growthCards.map((card, index) => {
                    const meta = getGrowthMeta(card.percent);
                    return (
                      <div key={index} className="stat-card growth-card">
                        <div className="stat-label">{card.label}</div>
                        <div className="stat-value stat-value-animate">
                          {formatValue(card.value, card.format)}
                        </div>
                        <div className={`growth-meta ${meta.direction}`}>
                          <span className="growth-arrow">
                            {meta.direction === "up" && "↑"}
                            {meta.direction === "down" && "↓"}
                            {meta.direction === "flat" && "→"}
                          </span>
                          {meta.display}
                        </div>
                        <div className="stat-sub">vs previous period</div>
                      </div>
                    );
                  })}
              {!isFetchingGrowth && growthCards.length === 0 && (
                <div className="empty-state">No growth data available.</div>
              )}
            </div>
          </section>
        )}

        {!isStaff && !lockedPlan && activeSection === "sales-trend" && (
          <section className="dash-section" id="sales-trend">
            <div className="section-header">
              <p>Revenue performance over time.</p>
              {selectedLocation && (
                <span className="filter-chip">Filtered by: {selectedLocation}</span>
              )}
            </div>
            <div className="toggle-row">
              <button
                type="button"
                className={salesTrendMode === "overall" ? "active" : ""}
                onClick={() => setSalesTrendMode("overall")}
              >
                Overall
              </button>
              <button
                type="button"
                className={salesTrendMode === "location" ? "active" : ""}
                onClick={() => setSalesTrendMode("location")}
              >
                By Location
              </button>
            </div>
            <div className="chart-card">
              {isFetchingSalesTrend ? (
                <div className="chart-skeleton">
                  <div className="skeleton-line long"></div>
                  <div className="skeleton-line medium"></div>
                  <div className="skeleton-line short"></div>
                </div>
              ) : salesTrendLabels.length === 0 ? (
                <div className="empty-state">No sales trend data available.</div>
              ) : (
                <Line
                  data={salesTrendChartData}
                  options={salesTrendChartOptions}
                />
              )}
            </div>
          </section>
        )}

        {!isStaff && !lockedPlan && activeSection === "category-products" && (
          <section className="dash-section" id="category-products">
            <div className="section-header">
              <p>Category revenue and top products.</p>
            </div>
            <div className="category-grid">
              <div className="category-left">
                <div className="chart-card pie-card">
                  {isFetchingCategory ? (
                    <div className="chart-skeleton">
                      <div className="skeleton-line long"></div>
                      <div className="skeleton-line medium"></div>
                      <div className="skeleton-line short"></div>
                    </div>
                  ) : categoryItems.length === 0 ? (
                    <div className="empty-state">
                      No category data available.
                    </div>
                  ) : (
                    <Pie data={categoryChartData} options={categoryChartOptions} />
                  )}
                </div>

                <div className="table-card">
                  <div className="tab-switch">
                    <button
                      type="button"
                      className={activeProductsTab === "quantity" ? "active" : ""}
                      onClick={() => setActiveProductsTab("quantity")}
                    >
                      Top by Quantity
                    </button>
                    <button
                      type="button"
                      className={activeProductsTab === "revenue" ? "active" : ""}
                      onClick={() => setActiveProductsTab("revenue")}
                    >
                      Top by Revenue
                    </button>
                  </div>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Product Name</th>
                          <th>Category</th>
                          <th>Quantity</th>
                          <th>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeProductsTab === "quantity"
                          ? topByQuantity
                          : topByRevenue
                        ).map((row) => (
                          <tr key={row?.product_id}>
                            <td>{row?.product_name}</td>
                            <td>{row?.category_name}</td>
                            <td>{formatValue(row?.quantity_sold)}</td>
                            <td>{formatValue(row?.revenue, "currency")}</td>
                          </tr>
                        ))}
                        {(activeProductsTab === "quantity"
                          ? topByQuantity
                          : topByRevenue
                        ).length === 0 && (
                          <tr>
                            <td colSpan={4}>No product data available.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="table-card category-legend-card">
                <div className="table-title">
                  <i className="bi bi-pie-chart"></i> Category Share
                </div>
                {isFetchingCategory ? (
                  <div className="chart-skeleton">
                    <div className="skeleton-line long"></div>
                    <div className="skeleton-line medium"></div>
                    <div className="skeleton-line short"></div>
                  </div>
                ) : categoryItems.length === 0 ? (
                  <div className="empty-state">No category data available.</div>
                ) : (
                  <div className="category-legend">
                    {categoryItems.map((item) => (
                      <div key={item?.category_id} className="legend-row">
                        <span className="legend-name">
                          {item?.category_name}
                        </span>
                        <span className="legend-percent">
                          {item?.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {!isStaff && !lockedPlan && activeSection === "location-performance" && (
          <section className="dash-section" id="location-performance">
            <div className="section-header">
              <p>Location-wise revenue and order performance.</p>
            </div>
            <div className="table-card">
              <div className="table-title">
                <i className="bi bi-geo-alt"></i> Location Performance
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>City</th>
                      <th>Revenue</th>
                      <th>Orders</th>
                      <th>Growth %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isFetchingLocationPerf ? (
                      <tr>
                        <td colSpan={4}>Loading...</td>
                      </tr>
                    ) : locationPerfRows.length > 0 ? (
                      locationPerfRows.map((row, idx) => (
                        <tr key={`loc-${idx}`}>
                          <td>{row?.city || row?.location || row?.name || '-'}</td>
                          <td>{formatValue(row?.revenue, "currency")}</td>
                          <td>{formatValue(row?.orders)}</td>
                          <td>{formatValue(row?.growth_percent || row?.growth || 0)}%</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4}>No location data available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {!isStaff && !lockedPlan && activeSection === "inventory-intelligence" && (
          <section className="dash-section" id="inventory-intelligence">
            <div className="section-header">
              <p>Stock health, dead stock, and fast movers.</p>
            </div>
            <div className="card-grid inventory-summary-grid">
              {isFetchingInventory
                ? Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="stat-card skeleton-card">
                      <div className="skeleton-line short"></div>
                      <div className="skeleton-line long"></div>
                      <div className="skeleton-line medium"></div>
                    </div>
                  ))
                : [
                    {
                      label: "Total Stock Value",
                      value: inventorySummary.total_stock_value,
                      format: "currency",
                      icon: "bi bi-boxes",
                    },
                    {
                      label: "Dead Stock Value",
                      value: inventorySummary.dead_stock_value,
                      format: "currency",
                      icon: "bi bi-x-octagon",
                    },
                    {
                      label: "Total Stock Quantity",
                      value: inventorySummary.total_stock_quantity,
                      format: "number",
                      icon: "bi bi-archive",
                    },
                  ].map((card, index) => (
                    <div key={index} className="stat-card">
                      <div className="stat-icon">
                        <i className={card.icon}></i>
                      </div>
                      <div className="stat-label">{card.label}</div>
                      <div className="stat-value">
                        {formatValue(card.value, card.format)}
                      </div>
                    </div>
                  ))}
            </div>

            <div className="inventory-grid">
              <div className="table-card table-warning">
              <div className="table-title">
                <i className="bi bi-exclamation-triangle"></i> Low Stock
              </div>
                <div className="table-wrapper scroll-y">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Current</th>
                        <th>Min Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isFetchingInventory ? (
                        <tr>
                          <td colSpan={3}>Loading...</td>
                        </tr>
                      ) : lowStockRows.length > 0 ? (
                        lowStockRows.map((row) => (
                          <tr key={row?.product_id}>
                            <td>{row?.product_name}</td>
                            <td>{formatValue(row?.current_stock)}</td>
                            <td>{formatValue(row?.min_stock_level)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3}>No low stock items.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="table-card table-danger">
              <div className="table-title">
                <i className="bi bi-exclamation-octagon"></i> Dead Stock
              </div>
                <div className="table-wrapper scroll-y">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Current</th>
                        <th>Last Sold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isFetchingInventory ? (
                        <tr>
                          <td colSpan={3}>Loading...</td>
                        </tr>
                      ) : deadStockRows.length > 0 ? (
                        deadStockRows.map((row) => (
                          <tr key={row?.product_id}>
                            <td>{row?.product_name}</td>
                            <td>{formatValue(row?.current_stock)}</td>
                            <td>{row?.last_sold_date || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3}>No dead stock items.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="table-card table-success">
              <div className="table-title">
                <i className="bi bi-lightning-charge"></i> Fast Moving
              </div>
                <div className="table-wrapper scroll-y">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Quantity Sold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isFetchingInventory ? (
                        <tr>
                          <td colSpan={2}>Loading...</td>
                        </tr>
                      ) : fastMovingRows.length > 0 ? (
                        fastMovingRows.map((row) => (
                          <tr key={row?.product_id}>
                            <td>{row?.product_name}</td>
                            <td>{formatValue(row?.quantity_sold)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2}>No fast moving items.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {!isStaff && !lockedPlan && activeSection === "customer-credit" && (
          <section className="dash-section" id="customer-credit">
            <div className="section-header">
              <p>Top customers, credit exposure, and loyalty metrics.</p>
            </div>

            <div className="table-card">
              <div className="table-title">
                <i className="bi bi-people"></i> Top Customers
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isFetchingCustomerCredit ? (
                      <tr>
                        <td colSpan={3}>Loading...</td>
                      </tr>
                    ) : topCustomers.length > 0 ? (
                      topCustomers.map((row) => (
                        <tr key={row?.customer_id}>
                          <td>{row?.customer_name}</td>
                          <td>{formatValue(row?.total_orders)}</td>
                          <td>{formatValue(row?.total_revenue, "currency")}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3}>No customer data available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card-grid credit-grid">
              {isFetchingCustomerCredit
                ? Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="stat-card skeleton-card">
                      <div className="skeleton-line short"></div>
                      <div className="skeleton-line long"></div>
                      <div className="skeleton-line medium"></div>
                    </div>
                  ))
                : [
                    {
                      label: "Total Outstanding",
                      value: creditSummary.total_outstanding,
                      format: "currency",
                      icon: "bi bi-wallet2",
                    },
                    {
                      label: "Overdue Amount",
                      value: creditSummary.overdue_amount,
                      format: "currency",
                      icon: "bi bi-exclamation-diamond",
                      tone: "danger",
                    },
                    {
                      label: "Customers with Credit",
                      value: creditSummary.customers_with_credit,
                      format: "number",
                      icon: "bi bi-person-badge",
                    },
                  ].map((card, index) => (
                    <div
                      key={index}
                      className={`stat-card${card.tone ? ` tone-${card.tone}` : ""}`}
                    >
                      <div className="stat-icon">
                        <i className={card.icon}></i>
                      </div>
                      <div className="stat-label">{card.label}</div>
                      <div className="stat-value">
                        {formatValue(card.value, card.format)}
                      </div>
                    </div>
                  ))}
            </div>

            <div className="card-grid metrics-grid">
              {isFetchingCustomerCredit ? (
                Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="stat-card skeleton-card">
                    <div className="skeleton-line short"></div>
                    <div className="skeleton-line long"></div>
                    <div className="skeleton-line medium"></div>
                  </div>
                ))
              ) : (
                <>
                  <div className="stat-card">
                    <div className="stat-label">New Customers</div>
                    <div className="stat-value">
                      {formatValue(customerMetrics.new_customers)}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Repeat Customer Rate</div>
                    <div className="stat-value">
                      {formatValue(
                        customerMetrics.repeat_customer_rate,
                        "number"
                      )}
                      %
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${customerMetrics.repeat_customer_rate || 0}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {!isStaff && !lockedPlan && activeSection === "smart-insights" && (
          <section className="dash-section" id="smart-insights">
            <div className="section-header">
              <p>Automated insights to guide business decisions.</p>
            </div>
            <div className="card-grid insights-grid">
              {isFetchingInsights
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="stat-card skeleton-card">
                      <div className="skeleton-line short"></div>
                      <div className="skeleton-line long"></div>
                      <div className="skeleton-line medium"></div>
                    </div>
                  ))
                : insights.map((item, index) => (
                    <div
                      key={index}
                      className={`insight-card insight-${item?.severity || "info"}`}
                    >
                      <div className="insight-icon">
                        <i className={getInsightIcon(item?.type)}></i>
                      </div>
                      <div className="insight-message">{item?.message}</div>
                    </div>
                  ))}
              {!isFetchingInsights && insights.length === 0 && (
                <div className="empty-state">No insights available.</div>
              )}
            </div>
          </section>
        )}

        {!isStaff &&
          !lockedPlan &&
          activeSection !== "overview" &&
          activeSection !== "revenue-overview" &&
          activeSection !== "growth-comparison" &&
          activeSection !== "sales-trend" &&
          activeSection !== "category-products" &&
          activeSection !== "location-performance" &&
          activeSection !== "inventory-intelligence" &&
          activeSection !== "customer-credit" &&
          activeSection !== "smart-insights" && (
            <div className="empty-state section-placeholder">
              Select a section from the sidebar to view data.
            </div>
          )}
      </main>
    </div>
  );
};

export default DashboardOverview;
