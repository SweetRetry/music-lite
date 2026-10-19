// The + in the 创建的歌单 header. The dialog it opens lives in PlaylistDialogs.
import { Button } from "@ncm-lite/ui/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ncm-lite/ui/components/ui/tooltip";
import { Plus } from "lucide-react";
import { openPlaylistDialog } from "./dialogs";

export function NewPlaylistButton({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="新建歌单"
            className={className}
            onClick={() => openPlaylistDialog({ kind: "create" })}
          />
        }
      >
        <Plus />
      </TooltipTrigger>
      <TooltipContent>新建歌单</TooltipContent>
    </Tooltip>
  );
}
