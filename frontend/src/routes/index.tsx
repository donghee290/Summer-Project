import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "../pages/HomePage";
import { SearchPage } from "../pages/SearchPage";

const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/search" element={<SearchPage />} />
    </Routes>
  </BrowserRouter>
);

export default AppRoutes;