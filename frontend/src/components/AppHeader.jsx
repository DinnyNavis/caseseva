import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearToken, getMe, logout } from "../api";

export default function AppHeader({ children }) {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getMe().then((result) => setUser(result.user)).catch(() => {});
  }, []);

  const signOut = async () => {
    clearToken();
    navigate("/login", { replace: true });
    await logout();
  };

  return (
    <>
      <header>
        <Link to="/dashboard"><strong>CaseSeva.ai</strong></Link>
        <nav>
          {user && <span data-testid="header-user">{user.full_name}</span>}
          <Link to="/profile">Profile</Link>
          <button type="button" onClick={signOut}>Logout</button>
        </nav>
      </header>
      {children}
    </>
  );
}
