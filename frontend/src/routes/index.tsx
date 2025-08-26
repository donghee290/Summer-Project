import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "../components/layout/Layout";

// --- Pages (비기사 기능 포함: 기존 라우트 보존) ---
import { HomePage } from "../pages/HomePage";
import { SearchPage } from "../pages/search";
import { LoginPage, RegisterPage, PasswordResetPage } from "../pages/user";
import { CommunityHomePage, RepositoryFeedPage, PostCreatePage, PostDetailPage } from "../pages/community";

// --- Articles ---
import { ArticleListPage, ArticleDetailPage } from "../pages/article";
import ArticlesPage from "../pages/article/ArticlesPage"; // 카테고리 Top3 전용

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Layout 없는 페이지 */}
        <Route path="/user/login" element={<LoginPage />} />
        <Route path="/user/register" element={<RegisterPage />} />
        <Route path="/user/password-reset" element={<PasswordResetPage />} />

        {/* Layout 적용된 페이지 */}
        <Route path="/" element={<Layout><HomePage /></Layout>} />
        <Route path="/search" element={<Layout><SearchPage /></Layout>} />

        {/* Articles: 공용 목록 & 상세 */}
        <Route path="/articles" element={<Layout><ArticleListPage /></Layout>} />
        <Route path="/articles/:articleId" element={<Layout><ArticleDetailPage /></Layout>} />

        {/* Articles: 카테고리 Top3 페이지 */}
        <Route path="/koreaeconomy" element={<Layout><ArticlesPage /></Layout>} />
        <Route path="/globaleconomy" element={<Layout><ArticlesPage /></Layout>} />
        <Route path="/society" element={<Layout><ArticlesPage /></Layout>} />
        <Route path="/trend" element={<Layout><ArticlesPage /></Layout>} />

        {/* Community */}
        <Route path="/community" element={<Layout><CommunityHomePage /></Layout>} />
        <Route path="/community/repository/:repoId" element={<Layout><RepositoryFeedPage /></Layout>} />
        <Route path="/community/repository/:repoId/new" element={<Layout><PostCreatePage /></Layout>} />
        <Route path="/community/post/:postId" element={<Layout><PostDetailPage /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}