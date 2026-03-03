"use client";

import { useReactFlow } from "@xyflow/react";
import { Maximize2, ZoomIn, ZoomOut, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Panel } from "@/components/ai-elements/panel";

type WorkflowControlsProps = {
  showMinimap?: boolean;
  onMinimapToggle?: (show: boolean) => void;
};

/** Matches Vercel workflow-builder-template Controls (zoom in/out, fit view, minimap) */
export const WorkflowControls = ({
  showMinimap = false,
  onMinimapToggle,
}: WorkflowControlsProps) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const toggleMinimap = () => {
    if (onMinimapToggle) onMinimapToggle(!showMinimap);
  };

  return (
    <Panel
      className="workflow-controls-panel border-none bg-transparent p-0"
      position="bottom-left"
    >
      <ButtonGroup orientation="vertical">
        <Button
          className="border hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5 disabled:[&>svg]:text-muted-foreground"
          onClick={() => zoomIn()}
          size="icon"
          title="Zoom in"
          variant="secondary"
        >
          <ZoomIn className="size-4" />
        </Button>
        <Button
          className="border hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5 disabled:[&>svg]:text-muted-foreground"
          onClick={() => zoomOut()}
          size="icon"
          title="Zoom out"
          variant="secondary"
        >
          <ZoomOut className="size-4" />
        </Button>
        <Button
          className="border hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5 disabled:[&>svg]:text-muted-foreground"
          onClick={() => fitView({ padding: 0.2, duration: 300 })}
          size="icon"
          title="Fit view"
          variant="secondary"
        >
          <Maximize2 className="size-4" />
        </Button>
        {onMinimapToggle && (
          <Button
            className={`border hover:bg-black/5 dark:hover:bg-white/5 disabled:[&>svg]:text-muted-foreground ${showMinimap ? "bg-muted" : ""}`}
            onClick={toggleMinimap}
            size="icon"
            title={showMinimap ? "Hide minimap" : "Show minimap"}
            variant="secondary"
          >
            <Map className="size-4" />
          </Button>
        )}
      </ButtonGroup>
    </Panel>
  );
};
