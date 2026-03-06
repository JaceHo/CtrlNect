import { useState } from "react";
import { X, Play, Pause, RotateCcw, CheckCircle2, Circle, AlertCircle, Loader2, Plus } from "lucide-react";
import type { SubTask, SubTaskStatus } from "@/hooks/use-chat";

interface TaskManagerDialogProps {
  subTasks: SubTask[];
  onInterruptTask: (taskId: string) => void;
  onRetryTask: (taskId: string) => void;
  onAddTask: (input: string) => void;
  onClose: () => void;
}

export function TaskManagerDialog({
  subTasks,
  onInterruptTask,
  onRetryTask,
  onAddTask,
  onClose,
}: TaskManagerDialogProps) {
  const [newTaskInput, setNewTaskInput] = useState("");
  const [showAddInput, setShowAddInput] = useState(false);

  const handleAddTask = () => {
    if (newTaskInput.trim()) {
      onAddTask(newTaskInput.trim());
      setNewTaskInput("");
      setShowAddInput(false);
    }
  };

  const getStatusIcon = (status: SubTaskStatus) => {
    switch (status) {
      case "pending":
        return <Circle size={14} className="text-text-muted" />;
      case "running":
        return <Loader2 size={14} className="text-blue-400 animate-spin" />;
      case "completed":
        return <CheckCircle2 size={14} className="text-green-400" />;
      case "failed":
        return <AlertCircle size={14} className="text-red-400" />;
      case "interrupted":
        return <Pause size={14} className="text-yellow-400" />;
    }
  };

  const getStatusColor = (status: SubTaskStatus) => {
    switch (status) {
      case "pending": return "text-text-muted";
      case "running": return "text-blue-400";
      case "completed": return "text-green-400";
      case "failed": return "text-red-400";
      case "interrupted": return "text-yellow-400";
    }
  };

  const runningCount = subTasks.filter(t => t.status === "running").length;
  const completedCount = subTasks.filter(t => t.status === "completed").length;
  const failedCount = subTasks.filter(t => t.status === "failed").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-[600px] max-h-[80vh] bg-bg-secondary rounded-xl border border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Task Manager</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {subTasks.length} tasks · {completedCount} done · {failedCount} failed
              {runningCount > 0 && ` · ${runningCount} running`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {subTasks.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <p className="text-sm">No sub-tasks yet</p>
              <p className="text-xs mt-1">Tasks will appear when the agent spawns sub-agents</p>
            </div>
          ) : (
            subTasks.map((task, index) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors"
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {getStatusIcon(task.status)}
                </div>

                {/* Task Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">#{index + 1}</span>
                    <span className={`text-sm font-medium ${getStatusColor(task.status)}`}>
                      {task.name}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted truncate mt-0.5">
                    {task.input.slice(0, 60)}{task.input.length > 60 ? "..." : ""}
                  </p>
                  {task.error && (
                    <p className="text-xs text-red-400 mt-1 truncate">
                      Error: {task.error}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {task.status === "running" && (
                    <button
                      onClick={() => onInterruptTask(task.id)}
                      className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="Interrupt"
                    >
                      <Pause size={14} />
                    </button>
                  )}
                  {(task.status === "failed" || task.status === "interrupted") && (
                    <button
                      onClick={() => onRetryTask(task.id)}
                      className="p-1.5 rounded-md text-text-muted hover:text-green-400 hover:bg-green-400/10 transition-colors"
                      title="Retry"
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Task Input */}
        {showAddInput ? (
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                placeholder="Enter task description..."
                className="flex-1 px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                autoFocus
              />
              <button
                onClick={handleAddTask}
                className="px-3 py-2 bg-accent text-bg-primary rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddInput(false)}
                className="px-3 py-2 bg-bg-tertiary text-text-muted rounded-lg text-sm hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-t border-border">
            <button
              onClick={() => setShowAddInput(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-bg-tertiary hover:bg-bg-secondary border border-dashed border-border rounded-lg text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              <Plus size={14} />
              Add New Task
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
