import { Switch, Route, Redirect } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const WelcomePage = lazy(() => import("@/pages/welcome"));
const StylePickerPage = lazy(() => import("@/pages/style-picker"));
const DetailsPage = lazy(() => import("@/pages/details"));
const ProjectsPage = lazy(() => import("@/pages/projects"));
const StagePage = lazy(() => import("@/pages/stage"));
const DocumentsPage = lazy(() => import("@/pages/documents"));
const DocumentViewPage = lazy(() => import("@/pages/document-view"));
const SessionSectionsPage = lazy(() => import("@/pages/session-sections"));
const SessionSurveyPage = lazy(() => import("@/pages/session-survey"));
const AdminPage = lazy(() => import("@/pages/admin"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Switch>
      <Route path="/" component={WelcomePage} />
      <Route path="/style" component={StylePickerPage} />
      <Route path="/intake">{() => <Redirect to="/details" />}</Route>
      <Route path="/details" component={DetailsPage} />
      <Route path="/projects" component={ProjectsPage} />
      <Route path="/stage/:stageId" component={StagePage} />
      <Route path="/interview/:projectId">{() => <Redirect to="/session/survey" />}</Route>
      <Route path="/documents/:projectId" component={DocumentsPage} />
      <Route path="/document/:projectId/:stageId" component={DocumentViewPage} />
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
