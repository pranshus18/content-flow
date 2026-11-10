import { SelectContent, SelectGroup, SelectItem, SelectLabel } from '@/components/ui/select';
import { TIMELINE_TRANSITION_LABELS } from '@/lib/editorTimeline';
import { EDITOR_TRANSITION_GROUPS } from '@/lib/editorTransitionPreviewStyles';

type Props = {
  className?: string;
  /** Smaller text for side panel / inspector */
  compact?: boolean;
};

export function TransitionSelectContent({ className, compact }: Props) {
  return (
    <SelectContent className={className}>
      <SelectItem value="none">{TIMELINE_TRANSITION_LABELS.none}</SelectItem>
      {EDITOR_TRANSITION_GROUPS.map((group) => (
        <SelectGroup key={group.label}>
          <SelectLabel className={compact ? 'text-[10px] text-zinc-500' : undefined}>
            {group.label}
          </SelectLabel>
          {group.transitions.map((tr) => (
            <SelectItem key={tr} value={tr} className={compact ? 'text-xs' : undefined}>
              {TIMELINE_TRANSITION_LABELS[tr]}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </SelectContent>
  );
}
