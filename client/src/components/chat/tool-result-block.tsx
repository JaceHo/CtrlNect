import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DiffViewer } from "./diff-viewer";

interface ToolResultBlockProps {
  content: string;
  isError?: boolean;
  toolName?: string;
}

const MAX_PREVIEW = 300;

export function ToolResultBlock({ content, isError, toolName }: ToolResultBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > MAX_PREVIEW;

  // Determine if content should be rendered as diff
  const isDiff = useMemo(() => {
    if (isError) return false;
    const isEditTool = toolName === "Edit" || toolName === "Write";
    const hasDiffContent = content.includes("old_string") ||
                          content.includes("new_string") ||
                          content.startsWith("+") ||
                          content.startsWith("-") ||
                          content.includes("Replaced");
    return isEditTool || hasDiffContent;
  }, [content, isError, toolName]);

  // Show first few lines as preview
  const preview = content.split("\n").slice(0, 3).join("\n");
  const showPreview = isLong && !expanded;

  return (
    <div className="my-1 ml-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
      >
        <span className={isError ? "text-red-400/70" : "text-green-500/70"}>
          {isError ? "✕ Error" : toolName ? `✓ ${toolName}` : "✓ Output"}
        </span>
        {isLong && (
          <>
            <span>({content.length} chars)</span>
            <ChevronDown size={10} className={!expanded ? "rotate-[-90deg]" : ""} />
          </>
        )}
      </button>

      {(expanded || !isLong) && (
        <div className="mt-1 ml-0 bg-bg-tertiary/30 rounded-md overflow-hidden">
          {isDiff ? (
            <DiffViewer content={showPreview ? preview + "..." : content} />
          ) : (
            <pre className="text-[10px] text-text-secondary/70 p-2 overflow-x-auto whitespace-pre-wrap font-mono">
              {showPreview ? preview + "..." : content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
