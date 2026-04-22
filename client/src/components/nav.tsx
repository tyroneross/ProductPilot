import { useLocation } from "wouter";
import { Menu, User, FolderKanban, Settings, LogOut, LogIn, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Nav() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      setLocation("/");
    } catch {
      // Ignore sign-out errors — redirect anyway
      setLocation("/");
    }
  };

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: "56px",
        display: "flex",
        alignItems: "center",
        background: "rgba(17,15,13,0.92)",
        backdropFilter: "blur(12px) saturate(1.2)",
        WebkitBackdropFilter: "blur(12px) saturate(1.2)",
        borderBottom: "1px solid rgba(200,180,160,0.08)",
        fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          width: "100%",
          margin: "0 auto",
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
        className="nav-inner"
      >
        {/* Wordmark */}
        <a
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            textDecoration: "none",
            fontWeight: 700,
            fontSize: "17px",
            color: "#f5f0eb",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          {/* Amber diamond dot */}
          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" style={{ flexShrink: 0 }}>
            <rect x="1" y="1" width="8" height="8" rx="1.5" fill="#f0b65e" transform="rotate(45 5 5)" />
          </svg>
          Product<span style={{ color: "#f0b65e" }}>Pilot</span>
        </a>

        {/* Hamburger menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Open menu"
              aria-haspopup="true"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "44px",
                height: "44px",
                background: "none",
                border: "1px solid rgba(200,180,160,0.12)",
                borderRadius: "8px",
                cursor: "pointer",
                color: "#a89a8c",
                flexShrink: 0,
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(200,180,160,0.28)";
                e.currentTarget.style.color = "#f5f0eb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(200,180,160,0.12)";
                e.currentTarget.style.color = "#a89a8c";
              }}
            >
              <Menu size={18} />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={8}
            style={{
              background: "#1a1714",
              border: "1px solid rgba(200,180,160,0.10)",
              borderRadius: "10px",
              minWidth: "200px",
              padding: "6px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            {isAuthenticated ? (
              <>
                {/* User identity */}
                <div
                  style={{
                    padding: "8px 10px 10px",
                    borderBottom: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: "rgba(240,182,94,0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <User size={14} color="#f0b65e" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      {user?.name && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#f5f0eb",
                            lineHeight: 1.3,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "140px",
                          }}
                        >
                          {user.name}
                        </p>
                      )}
                      <p
                        style={{
                          margin: 0,
                          fontSize: "11px",
                          color: "#6b5d52",
                          lineHeight: 1.3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "140px",
                        }}
                      >
                        {user?.email}
                      </p>
                    </div>
                  </div>
                </div>

                <DropdownMenuSeparator style={{ background: "rgba(200,180,160,0.08)", margin: "4px 0" }} />

                <DropdownMenuItem
                  onSelect={() => setLocation("/projects")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "9px 10px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#c8b4a0",
                    cursor: "pointer",
                    outline: "none",
                  }}
                  className="nav-item"
                >
                  <FolderKanban size={15} />
                  Projects
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => setLocation("/settings")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "9px 10px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#c8b4a0",
                    cursor: "pointer",
                    outline: "none",
                  }}
                  className="nav-item"
                >
                  <Settings size={15} />
                  Settings
                </DropdownMenuItem>

                <DropdownMenuSeparator style={{ background: "rgba(200,180,160,0.08)", margin: "4px 0" }} />

                <DropdownMenuItem
                  onSelect={handleSignOut}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "9px 10px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#e07070",
                    cursor: "pointer",
                    outline: "none",
                  }}
                  className="nav-item-destructive"
                >
                  <LogOut size={15} />
                  Sign Out
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem
                  onSelect={() => setLocation("/details")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "9px 10px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#f0b65e",
                    cursor: "pointer",
                    outline: "none",
                  }}
                  className="nav-item"
                >
                  <Plus size={15} />
                  Start Building
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => setLocation("/projects")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "9px 10px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#c8b4a0",
                    cursor: "pointer",
                    outline: "none",
                  }}
                  className="nav-item"
                >
                  <FolderKanban size={15} />
                  Projects
                </DropdownMenuItem>

                <DropdownMenuSeparator style={{ background: "rgba(200,180,160,0.08)", margin: "4px 0" }} />

                <DropdownMenuItem
                  onSelect={() => setLocation("/login")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "9px 10px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#c8b4a0",
                    cursor: "pointer",
                    outline: "none",
                  }}
                  className="nav-item"
                >
                  <LogIn size={15} />
                  Sign In
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .nav-inner {
            padding: 0 20px !important;
          }
        }
        .nav-item:hover, .nav-item:focus {
          background: rgba(200,180,160,0.07) !important;
          color: #f5f0eb !important;
        }
        .nav-item-destructive:hover, .nav-item-destructive:focus {
          background: rgba(224,112,112,0.08) !important;
          color: #e07070 !important;
        }
      `}</style>
    </nav>
  );
}
