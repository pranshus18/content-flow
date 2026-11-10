import { Check, ChevronDown, Minus } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { editorCardClass } from '@/components/video-editor/editorUi';

type Row = { feature: string; status: 'yes' | 'partial' | 'no'; note?: string };

const ROWS: Row[] = [
  { feature: 'Multi-clip timeline + transitions', status: 'yes' },
  { feature: 'Trim, split, speed, reverse, rotate', status: 'yes' },
  { feature: 'Filters, adjust, effects, opacity', status: 'yes' },
  { feature: 'Text + caption styles + presets', status: 'yes' },
  { feature: 'Stickers + PiP overlays', status: 'yes' },
  { feature: 'Background music + voiceover', status: 'yes' },
  { feature: 'Templates + auto-assemble', status: 'yes' },
  { feature: 'Green screen / chroma key', status: 'yes' },
  { feature: 'Export to social drafts', status: 'yes' },
  { feature: 'AI video generator (Seedance/Sora)', status: 'no', note: 'Use Create flow + Gemini video' },
  { feature: 'One-click background remover (AI)', status: 'partial', note: 'Chroma key; full AI matting N/A' },
  { feature: 'Body/face effects, motion tracking', status: 'no', note: 'Requires dedicated ML models' },
  { feature: 'Massive stock library + beat sync', status: 'partial', note: 'Assets + music catalog' },
  { feature: 'EditPilot / full multitrack NLE', status: 'partial', note: 'Social-focused studio' },
];

function StatusIcon({ status }: { status: Row['status'] }) {
  if (status === 'yes') return <Check className="w-3.5 h-3.5 text-primary shrink-0" />;
  if (status === 'partial') return <Minus className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />;
}

export function CapCutFeatureMatrix({ compact = false }: { compact?: boolean }) {
  return (
    <Collapsible className={cn(editorCardClass, compact ? 'text-xs' : 'text-sm')}>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left hover:bg-secondary/30 transition-colors rounded-xl">
        <span className="text-xs font-medium text-muted-foreground">What this studio supports</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform [[data-state=open]_&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3.5 pb-3.5 pt-0">
        <p className="text-[11px] text-muted-foreground mb-2.5">
          Export uses the server FFmpeg pipeline — preview is approximate for transitions and effects.
        </p>
        <ul className={cn('space-y-2 pr-1', compact ? 'max-h-[140px] overflow-y-auto custom-scrollbar' : 'max-h-[260px] overflow-y-auto custom-scrollbar')}>
          {ROWS.map((row) => (
            <li key={row.feature} className="flex gap-2 items-start text-foreground/90 min-w-0">
              <StatusIcon status={row.status} />
              <span className="min-w-0 break-words">
                <span className="line-clamp-2 text-[11px] leading-snug">{row.feature}</span>
                {row.note && (
                  <span className="block text-[10px] text-muted-foreground truncate">{row.note}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
