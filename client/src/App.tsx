import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const WelcomePage = lazy(() => import("@/pages/welcome"));
const IntakePage = lazy(() => import("@/pages/start"));
const DetailsPage = lazy(() => import("@/pages/details"));
const ProjectsPage = lazy(() => import("@/pages/projects"));
const StagePage = lazy(() => import("@/pages/stage"));
const InterviewPage = lazy(() => import("@/pages/interview"));
const DocumentsPage = lazy(() => import("@/pages/documents"));
const SessionSectionsPage = lazy(() => import("@/pages/session-sections"));
const SessionSurveyPage = lazy(() => import("@/pages/session-survey"));
const AdminPage = lazy(() => import("@/pages/admin"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={WelcomePage} />
        <Route path="/intake" component={IntakePage} />
        <Route path="/details" component={DetailsPage} />
        <Route path="/projects" component={ProjectsPage} />
        <Route path="/stage/:stageId" component={StagePage} />
        <Route path="/interview/:projectId" component={InterviewPage} />
        <Route path="/documents/:projectId" component={DocumentsPage} />
        <Route path="/session/interview">{() => <Redirect to="/session/survey" />}</Route>
        <Route path="/session/sections" component={SessionSectionsPage} />
        <Route path="/session/survey" component={SessionSurveyPage} />
        <Route path="/admin" component={AdminPage} />
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
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
