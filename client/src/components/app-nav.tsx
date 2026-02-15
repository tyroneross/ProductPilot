import { useLocation } from "wouter";
import { Sparkles } from "lucide-react";

export default function AppNav() {
  const [location, setLocation] = useLocation();

  const links = [
    { href: "/", label: "Home" },
    { href: "/projects", label: "Projects" },
    { href: "/admin", label: "Prompts" },
  ];

  return (
    <nav className="border-b border-gray-200 bg-surface-primary px-6 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-contrast-high font-medium text-sm hover:text-accent transition-colors"
        >
          <Sparkles className="w-4 h-4 text-accent" />
          ProductPilot
        </button>
        <div className="flex items-center gap-4 sm:gap-6">
          {links.map((link) => {
            const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            return (
              <button
                key={link.href}
                onClick={() => setLocation(link.href)}
                className={`text-sm py-2 min-h-[44px] flex items-center transition-colors ${
                  isActive
                    ? "text-contrast-high font-medium border-b-2 border-accent"
                    : "text-contrast-medium hover:text-contrast-high"
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
