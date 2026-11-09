
import React, { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import RoleSelection from "./pages/RoleSelection";
import Login from "./pages/Login";
import Register from "./pages/Register";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./AdminDashboard";
import { getCurrentUser } from "./utils/complaints";

function ProtectedRoute({ children, requiredRole, user, account }) {
  if (!user || !account) {
    return <Navigate to="/" replace />;
  }

  const isAdmin = account.role === "admin";

  if (requiredRole === "admin" && !isAdmin) {
    return <Navigate to="/user" replace />;
  }

  if (requiredRole === "user" && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!active) return;

      setCheckingAuth(true);
      setUser(currentUser);

      if (!currentUser) {
        setAccount(null);
        sessionStorage.removeItem("campusfixRole");
        sessionStorage.removeItem("campusfixUserEmail");
        sessionStorage.removeItem("campusfixUserName");
        setCheckingAuth(false);
        return;
      }

      try {
        const profile = await getCurrentUser();

        if (!active) return;

        setAccount(profile);
        sessionStorage.setItem(
          "campusfixRole",
          profile.role === "admin" ? "admin" : "user"
        );
        sessionStorage.setItem("campusfixUserEmail", profile.email || "");
        sessionStorage.setItem("campusfixUserName", profile.name || "Student");
      } catch (error) {
        console.error(error);
        if (!active) return;
        setAccount(null);
      }

      setCheckingAuth(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (checkingAuth) {
    return <p>Loading CampusFix...</p>;
  }

  return (
    <Routes>
      <Route path="/" element={<RoleSelection />} />

      <Route path="/login/:role" element={<Login />} />

      <Route path="/register" element={<Register />} />

      <Route
        path="/user"
        element={
          <ProtectedRoute user={user} account={account} requiredRole="user">
            <UserDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute user={user} account={account} requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
