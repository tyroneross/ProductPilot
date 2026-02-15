import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-medium text-contrast-low mb-4">404</p>
        <h1 className="text-h3 font-medium text-contrast-high mb-2">Page not found</h1>
        <p className="text-description text-contrast-medium mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => setLocation("/")}
            className="btn-primary min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to home
          </Button>
          <Button
            variant="outline"
            onClick={() => setLocation("/projects")}
            className="min-h-[44px]"
          >
            View projects
          </Button>
        </div>
      </div>
    </div>
  );
}
