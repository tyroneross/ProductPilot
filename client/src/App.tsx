import { Switch, Route, Redirect } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";

const WelcomePage = lazy(() => import("@/pages/welcome"));
const DetailsPage = lazy(() => import("@/pages/details"));
const ProjectsPage = lazy(() => import("@/pages/projects"));
const StagePage = lazy(() => import("@/pages/stage"));
const DocumentsPage = lazy(() => import("@/pages/documents"));
const DocumentViewPage = lazy(() => import("@/pages/document-view"));
const SessionSurveyPage = lazy(() => import("@/pages/session-survey"));
const AdminPage = lazy(() => import("@/pages/admin"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const LoginPage = lazy(() => import("@/pages/login"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#110f0d' }}>
      <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(200,180,160,0.08)', borderTopColor: '#f0b65e' }} />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Switch>
      <Route path="/" component={WelcomePage} />
      <Route path="/details" component={DetailsPage} />
      <Route path="/projects" component={ProjectsPage} />
      <Route path="/stage/:stageId" component={StagePage} />
      <Route path="/documents">
        <Redirect to="/projects" />
      </Route>
      <Route path="/documents/:projectId" component={DocumentsPage} />
      <Route path="/document/:projectId/:stageId" component={DocumentViewPage} />
      <Route path="/session/survey" component={SessionSurveyPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <ErrorBoundary>
          <Router />
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
