import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { getToken } from "./api";
import AppHeader from "./components/AppHeader";
import DashboardPage from "./pages/DashboardPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import SignupPage from "./pages/SignupPage";
import CaseCreatePage from "./pages/CaseCreatePage";
import CaseDetailPage from "./pages/CaseDetailPage";
import Preview1Page from "./pages/Preview1Page";
import Preview2Page from "./pages/Preview2Page";
import AdvocateDirectoryPage from "./pages/AdvocateDirectoryPage";
import AdvocateInboxPage from "./pages/AdvocateInboxPage";
import AdvocateReviewPage from "./pages/AdvocateReviewPage";
import AdminAdvocatesPage from "./pages/AdminAdvocatesPage";
import DocumentsPage from "./pages/DocumentsPage";

function ProtectedRoute() {
  return getToken() ? <AppHeader><Outlet /></AppHeader> : <Navigate to="/login" replace />;
}

function PublicRoute() {
  return getToken() ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/cases/new" element={<CaseCreatePage />} />
        <Route path="/cases/:caseId" element={<CaseDetailPage />} />
        <Route path="/cases/:caseId/preview1" element={<Preview1Page />} />
        <Route path="/cases/:caseId/preview2" element={<Preview2Page />} />
        <Route path="/advocates" element={<AdvocateDirectoryPage />} />
        <Route path="/advocate/inbox" element={<AdvocateInboxPage />} />
        <Route path="/advocate/review/:caseId" element={<AdvocateReviewPage />} />
        <Route path="/admin/advocates" element={<AdminAdvocatesPage />} />
        <Route path="/cases/:caseId/edit" element={<CaseCreatePage />} />
        <Route path="/cases/:caseId/documents" element={<DocumentsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
