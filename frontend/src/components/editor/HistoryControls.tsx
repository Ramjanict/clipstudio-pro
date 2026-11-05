import { undo, redo } from "@/store/editorSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { triggerAutosave } from "@/store/thunks";
import { RotateCcw, RotateCw } from "lucide-react";
import HistoryButton from "./HistoryButton";

interface HistoryControlsProps {
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  className?: string;
}

const HistoryControls: React.FC<HistoryControlsProps> = ({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  className = "",
}) => {
  const dispatch = useAppDispatch();
  const { past, future } = useAppSelector((state) => state.editor);

  const effectiveCanUndo = canUndo !== undefined ? canUndo : past.length > 0;
  const effectiveCanRedo = canRedo !== undefined ? canRedo : future.length > 0;

  const handleUndo = () => {
    if (onUndo) {
      const res = onUndo() as unknown;
      // If action creator was passed directly (returns an action object), dispatch it
      if (res && typeof res === "object" && "type" in res) {
        dispatch(res as any);
        dispatch(triggerAutosave());
      }
    } else {
      dispatch(undo());
      dispatch(triggerAutosave());
    }
  };

  const handleRedo = () => {
    if (onRedo) {
      const res = onRedo() as unknown;
      // If action creator was passed directly (returns an action object), dispatch it
      if (res && typeof res === "object" && "type" in res) {
        dispatch(res as any);
        dispatch(triggerAutosave());
      }
    } else {
      dispatch(redo());
      dispatch(triggerAutosave());
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <HistoryButton
        onClick={handleUndo}
        disabled={!effectiveCanUndo}
        icon={RotateCcw}
        title="Undo (Ctrl+Z)"
      />

      <HistoryButton
        onClick={handleRedo}
        disabled={!effectiveCanRedo}
        icon={RotateCw}
        title="Redo (Ctrl+Y)"
      />
    </div>
  );
};

export default HistoryControls;
