import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, Eye } from "lucide-react";

interface WireframePreviewProps {
  htmlContent: string;
}

export default function WireframePreview({ htmlContent }: WireframePreviewProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");

  return (
    <div className="w-full h-full flex flex-col bg-surface-primary">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "preview" | "code")} className="flex-1 flex flex-col">
        <div className="border-b border-gray-200 px-4 py-2">
          <TabsList>
            <TabsTrigger value="preview" className="flex items-center gap-2" data-testid="tab-preview">
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="code" className="flex items-center gap-2" data-testid="tab-code">
              <Code className="w-4 h-4" />
              HTML Code
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="preview" className="flex-1 m-0 p-4">
          <div className="w-full h-full border border-gray-300 rounded-lg overflow-hidden bg-white">
            <iframe
              srcDoc={htmlContent}
              title="Wireframe Preview"
              className="w-full h-full"
              sandbox=""
              data-testid="iframe-wireframe-preview"
            />
          </div>
        </TabsContent>

        <TabsContent value="code" className="flex-1 m-0 p-4">
          <div className="w-full h-full border border-gray-300 rounded-lg overflow-auto bg-gray-50">
            <pre className="p-4 text-sm font-mono text-contrast-high" data-testid="text-html-code">
              <code>{htmlContent}</code>
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
