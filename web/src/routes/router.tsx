import { createBrowserRouter } from "react-router-dom";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import HomePage from "@/pages/marketing/HomePage";
import PricingPage from "@/pages/marketing/PricingPage";
import StatusPage from "@/pages/marketing/StatusPage";
import TutorialPage from "@/pages/marketing/TutorialPage";
import { AuthLayout } from "@/pages/auth/AuthLayout";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ForgotPage from "@/pages/auth/ForgotPage";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { RequireAuth } from "@/components/dashboard/RequireAuth";
import OverviewPage from "@/pages/dashboard/OverviewPage";
import TokensPage from "@/pages/dashboard/TokensPage";
import LogsPage from "@/pages/dashboard/LogsPage";
import TopupPage from "@/pages/dashboard/TopupPage";
import ReferralPage from "@/pages/dashboard/ReferralPage";
import SettingsPage from "@/pages/dashboard/SettingsPage";
import AdminOverviewPage from "@/pages/admin/AdminOverviewPage";
import UsersPage from "@/pages/admin/UsersPage";
import ChannelsPage from "@/pages/admin/ChannelsPage";
import ModelsPage from "@/pages/admin/ModelsPage";
import GroupsPage from "@/pages/admin/GroupsPage";
import AdminLogsPage from "@/pages/admin/AdminLogsPage";
import RedemptionPage from "@/pages/admin/RedemptionPage";
import OrdersPage from "@/pages/admin/OrdersPage";
import AnnouncementsPage from "@/pages/admin/AnnouncementsPage";
import SystemSettingsPage from "@/pages/admin/SystemSettingsPage";
import NotFoundPage from "@/pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    element: <MarketingLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/pricing", element: <PricingPage /> },
      { path: "/status", element: <StatusPage /> },
      { path: "/tutorial", element: <TutorialPage /> },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/forgot", element: <ForgotPage /> },
    ],
  },
  {
    path: "/dashboard",
    element: (
      <RequireAuth>
        <DashboardLayout variant="user" />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "tokens", element: <TokensPage /> },
      { path: "logs", element: <LogsPage /> },
      { path: "topup", element: <TopupPage /> },
      { path: "referral", element: <ReferralPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  {
    path: "/admin",
    element: (
      <RequireAuth adminOnly>
        <DashboardLayout variant="admin" />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <AdminOverviewPage /> },
      { path: "users", element: <UsersPage /> },
      { path: "channels", element: <ChannelsPage /> },
      { path: "models", element: <ModelsPage /> },
      { path: "groups", element: <GroupsPage /> },
      { path: "logs", element: <AdminLogsPage /> },
      { path: "redemption", element: <RedemptionPage /> },
      { path: "orders", element: <OrdersPage /> },
      { path: "announcements", element: <AnnouncementsPage /> },
      { path: "settings", element: <SystemSettingsPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
