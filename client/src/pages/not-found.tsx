import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import Nav from "@/components/nav";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: "#110f0d" }}>
      <Nav />
      <div className="flex-1 flex items-center justify-center px-4">
        <Card
          className="w-full max-w-md border-[rgba(200,180,160,0.08)] bg-[#1a1714]"
        >
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-2 items-center">
              <AlertCircle className="h-8 w-8" style={{ color: "#f0b65e" }} />
              <h1
                className="text-2xl font-bold"
                style={{ color: "#f5f0eb" }}
              >
                Page not found
              </h1>
            </div>
            <p
              className="mt-2 text-sm"
              style={{ color: "#a89a8c", lineHeight: 1.5 }}
            >
              The page you're looking for doesn't exist or may have moved.
            </p>
            <div className="mt-5">
              <Link
                href="/"
                className="inline-flex items-center justify-center px-4 rounded-md font-semibold"
                style={{
                  background: "#f0b65e",
                  color: "#110f0d",
                  height: 44,
                  minWidth: 140,
                  fontSize: 14,
                  textDecoration: "none",
                  fontFamily: "inherit",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "#d4a04e";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "#f0b65e";
                }}
                data-testid="link-return-home"
              >
                Return home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
