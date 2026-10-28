import { useFeedback } from "../../../providers/FeedbackProvider";
import { useBindings } from "../../../providers/ModeProvider";
import { useView } from "../../../providers/ViewProvider";
import { cn } from "../../../lib/utils";
import { DeviceScreen } from "../DeviceScreen";

export type DisplayProps = {
  className?: string;
};

// The Device's screen as the current mode fills it, with notices in the
// footer and prompts and levels over it. It reaches up into the bezel,
// leaving an inset to the top edge.
export function Display({ className }: DisplayProps) {
  const { view } = useView();
  const { badge, footer, ...screen } = useBindings().screen;
  const { notice, prompt, overlay, progress } = useFeedback();
  return (
    <DeviceScreen
      className={cn(
        "mt-[calc(var(--spacing-inset)_-_var(--spacing-bezel))] min-w-0",
        className,
      )}
      view={view}
      {...screen}
      footer={[notice ?? footer[0], footer[1]]}
      badges={badge && !notice ? [badge] : undefined}
      overlay={progress ?? overlay ?? (prompt ? { label: prompt } : undefined)}
    />
  );
}
