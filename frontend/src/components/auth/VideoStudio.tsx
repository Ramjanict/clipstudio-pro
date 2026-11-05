import { openAuthModal } from "@/store/authSlice";
import { useAppDispatch } from "@/store/hooks";
import ActionButton from "../shared/ActionButton";

const VideoStudio = () => {
  const dispatch = useAppDispatch();
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-8 w-full max-w-md flex flex-col items-center text-center">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">
        VideoStudio
      </h1>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
        Sign in to start creating professional video templates.
      </p>
      <div className="w-full space-y-3">
        <ActionButton
          onClick={() => dispatch(openAuthModal("login"))}
          label="Sign In"
          className="w-full "
          size="lg"
        />
        <ActionButton
          onClick={() => dispatch(openAuthModal("login"))}
          label="Create Account"
          className="w-full "
          size="lg"
          variant="outline"
        />
      </div>
    </div>
  );
};

export default VideoStudio;
