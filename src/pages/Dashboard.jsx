import { useContext } from "react";
import DashboardOverview from "../components/Dashboard/DashboardOverview/DashboardOverview";
import { ThemeContext } from "../ThemeContext";

const Dashboard = ({ navigate}) => {
  const { theme, toggleTheme } = useContext(ThemeContext);
    return (
      <div className="wow-page">
        <div className="wow-motion-layer" aria-hidden="true">
          <span className="wow-orb orb-a"></span>
          <span className="wow-orb orb-b"></span>
          <span className="wow-orb orb-c"></span>
          <span className="wow-orb orb-d"></span>
          <span className="wow-ring ring-a"></span>
          <span className="wow-ring ring-b"></span>
          <span className="wow-pulse"></span>
        </div>
        <div className="wow-content container-fluid">
          {/* <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button> */}
          <DashboardOverview navigate = {navigate}/>
        </div>
      </div>
    );
  };
  
  export default Dashboard;
