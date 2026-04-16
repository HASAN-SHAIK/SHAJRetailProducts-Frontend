import Login from '../components/Login/Login';

const LoginPage = () => {
  return (
    <div className="wow-page login-page">
      <div className="wow-motion-layer" aria-hidden="true">
        <span className="wow-orb orb-a"></span>
        <span className="wow-orb orb-b"></span>
        <span className="wow-orb orb-c"></span>
        <span className="wow-orb orb-d"></span>
        <span className="wow-ring ring-a"></span>
        <span className="wow-ring ring-b"></span>
        <span className="wow-pulse"></span>
      </div>
      <div className="wow-content">
        <Login/>
      </div>
    </div>
  );
};

export default LoginPage;
