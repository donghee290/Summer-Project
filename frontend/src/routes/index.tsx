import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "../pages/HomePage";
import { SearchPage } from "../pages/search";
import { LoginPage, RegisterPage, PasswordResetPage } from "../pages/user";

const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/user/login" element={<LoginPage />} />
      <Route path="/user/register" element={<RegisterPage />} />
      <Route path="/user/password-reset" element={<PasswordResetPage />} />
    </Routes>
  </BrowserRouter>
);

export default AppRoutes;