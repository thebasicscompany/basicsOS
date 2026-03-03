import * as React from "react";

export function ColumnResizeHandle({
  onResize,
}: {
  onResize: (delta: number) => void;
}) {
  const startX = React.useRef(0);
  const isDragging = React.useRef(false);

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX.current = e.clientX;
      isDragging.current = true;

      const handleMouseMove = (me: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = me.clientX - startX.current;
        startX.current = me.clientX;
        onResize(delta);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onResize],
  );

  return (
    <div
      className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none hover:bg-primary/30 active:bg-primary/50 z-10"
      onMouseDown={handleMouseDown}
    />
  );
}
