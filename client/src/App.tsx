import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import StartPage from "@/pages/start";
import ProjectsPage from "@/pages/projects";
import StagePage from "@/pages/stage";
import InterviewPage from "@/pages/interview";
import DocumentsPage from "@/pages/documents";
import SessionSectionsPage from "@/pages/session-sections";
import SessionSurveyPage from "@/pages/session-survey";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={StartPage} />
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
