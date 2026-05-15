import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import "./index.css";
import App from "./pages/App.jsx";

axios.defaults.withCredentials = true;

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  config.headers.Authorization = `Bearer ${token || 'MISSING_IN_LOCALSTORAGE'}`;
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRoute = error.config && error.config.url && (error.config.url.includes('/auth/manual') || error.config.url.includes('/auth/signup'));
    if (error.response && error.response.status === 401 && !isAuthRoute) {
      localStorage.removeItem('isAdminLoggedIn');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userName');
      localStorage.removeItem('userPicture');
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);