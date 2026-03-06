import { useMemo } from "react";

interface DiffViewerProps {
  content: string;
}

interface DiffLine {
  type: "context" | "add" | "remove" | "header";
  content: string;
  lineNumber?: number;
}

function parseDiff(content: string): DiffLine[] {
  const lines: DiffLine[] = [];
  const contentLines = content.split("\n");

  for (const line of contentLines) {
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) {
      lines.push({ type: "header", content: line });
    } else if (line.startsWith("+")) {
      lines.push({ type: "add", content: line.slice(1) });
    } else if (line.startsWith("-")) {
      lines.push({ type: "remove", content: line.slice(1) });
    } else if (line.startsWith(" ")) {
      lines.push({ type: "context", content: line.slice(1) });
    } else if (line.length > 0) {
      // Plain text (like edit tool output without diff format)
      lines.push({ type: "context", content: line });
    }
  }

  return lines;
}

export function DiffViewer({ content }: DiffViewerProps) {
  const diffLines = useMemo(() => {
    // Check if content looks like a diff
    const hasDiffMarkers = content.includes("+++") || content.includes("---") ||
                          content.includes("@@") || content.includes("+ ") ||
                          content.startsWith("+") || content.startsWith("-");

    if (hasDiffMarkers) {
      return parseDiff(content);
    }

    // If not a diff, treat as context lines
    return content.split("\n").map(line => ({
      type: "context" as const,
      content: line
    }));
  }, [content]);

  // Check if this is specifically an Edit tool result
  const isEditResult = content.includes("old_string") ||
                       content.includes("new_string") ||
                       content.includes("Replaced");

  return (
    <div className="font-mono text-[11px] leading-relaxed">
      {diffLines.map((line, i) => {
        const getBgColor = () => {
          switch (line.type) {
            case "add": return "bg-green-500/15";
            case "remove": return "bg-red-500/15";
            case "header": return "bg-accent/20 text-accent";
            default: return "";
          }
        };

        const getTextColor = () => {
          switch (line.type) {
            case "add": return "text-green-400";
            case "remove": return "text-red-400";
            case "header": return "text-accent";
            default: return "text-text-secondary/70";
          }
        };

        const getPrefix = () => {
          switch (line.type) {
            case "add": return "+ ";
            case "remove": return "- ";
            default: return "  ";
          }
        };

        return (
          <div
            key={i}
            className={`px-2 py-0.5 ${getBgColor()} ${getTextColor()}`}
          >
            <span className="select-none opacity-50 mr-2">{getPrefix()}</span>
            {line.content}
          </div>
        );
      })}
    </div>
  );
}
