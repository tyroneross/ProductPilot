import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import WelcomePage from "@/pages/welcome";
import StylePickerPage from "@/pages/style-picker";
import DetailsPage from "@/pages/details";
import ProjectsPage from "@/pages/projects";
import StagePage from "@/pages/stage";
import DocumentsPage from "@/pages/documents";
import DocumentViewPage from "@/pages/document-view";
import SessionSectionsPage from "@/pages/session-sections";
import SessionSurveyPage from "@/pages/session-survey";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";

function Router() {
  return (
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
