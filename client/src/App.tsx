import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppNav from "@/components/app-nav";
import WelcomePage from "@/pages/welcome";
import DetailsPage from "@/pages/details";
import ProjectsPage from "@/pages/projects";
import StagePage from "@/pages/stage";
import DocumentsPage from "@/pages/documents";
import DocumentViewPage from "@/pages/document-view";
import SessionSurveyPage from "@/pages/session-survey";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";

// Pages where the global nav is hidden (full-screen / immersive layouts)
const HIDE_NAV_PATHS = ["/", "/session/survey"];

function Router() {
  const [location] = useLocation();
  const showNav = !HIDE_NAV_PATHS.includes(location);

  return (
    <>
      {showNav && <AppNav />}
      <Switch>
        <Route path="/" component={WelcomePage} />
        <Route path="/details" component={DetailsPage} />
        <Route path="/projects" component={ProjectsPage} />
        <Route path="/stage/:stageId" component={StagePage} />
        <Route path="/documents/:projectId" component={DocumentsPage} />
        <Route path="/document/:projectId/:stageId" component={DocumentViewPage} />
        <Route path="/session/survey" component={SessionSurveyPage} />
        <Route path="/admin" component={AdminPage} />
        {/* Legacy redirects */}
        <Route path="/style">{() => <Redirect to="/details" />}</Route>
        <Route path="/intake">{() => <Redirect to="/details" />}</Route>
        <Route path="/interview/:projectId">{() => <Redirect to="/session/survey" />}</Route>
        <Route path="/session/interview">{() => <Redirect to="/session/survey" />}</Route>
        <Route path="/session/sections">{() => <Redirect to="/session/survey" />}</Route>
        <Route component={NotFound} />
      </Switch>
    </>
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
