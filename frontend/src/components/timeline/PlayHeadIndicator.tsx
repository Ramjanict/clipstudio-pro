import { useAppSelector } from "@/store/hooks";
import { MdCheckBoxOutlineBlank } from "react-icons/md";

interface Props {
  pixelsPerSecond: number;
  handlePlayHeadMouseDown: (e: React.MouseEvent) => void;
}

const PlayHeadIndicator: React.FC<Props> = ({
  handlePlayHeadMouseDown,
  pixelsPerSecond,
}) => {
  const playHead = useAppSelector((state) => state.editor.playhead);

  return (
    <div
      className="absolute top-4 bottom-0 w-[1.5px] bg-sky-500 z-50 pointer-events-none transition-none ml-12"
      style={{ left: `${playHead * pixelsPerSecond}px` }}
    >
      <MdCheckBoxOutlineBlank
        size={24}
        className="absolute -top-1 -ml-[11px] cursor-ew-resize pointer-events-auto drop-shadow-md z-50 text-sky-600 fill-sky-600"
        onMouseDown={handlePlayHeadMouseDown}
      />
    </div>
  );
};

export default PlayHeadIndicator;
