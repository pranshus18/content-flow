/** Shared Tailwind class strings for the video editor chrome. */
export const editorShellClass =
  'flex flex-col min-w-0 overflow-hidden bg-[hsl(222_47%_4%)] text-foreground';

export const editorToolbarClass =
  'shrink-0 px-4 py-2.5 border-b border-border/70 flex flex-wrap items-center justify-between gap-3 bg-card/40 backdrop-blur-md';

export const editorCardClass =
  'rounded-xl border border-border/60 bg-card/35 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)]';

export const editorCardPadding = 'p-3.5';

export const editorSectionTitleClass =
  'text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground';

/** Softer label for embedded / dialog studio */
export const editorMonitorTitleClass =
  'text-xs font-medium text-foreground/90 tracking-tight';

export const editorMonitorBarClass =
  'shrink-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-2 border-b border-border/50 bg-card/30';

export const editorEmbeddedShellClass =
  'flex-1 min-h-0 h-full rounded-xl border border-border/60 ring-1 ring-white/[0.04] shadow-lg shadow-black/20 overflow-hidden';

export const editorPanelTitleClass = 'text-sm font-semibold text-foreground tracking-tight';

export const editorFieldLabelClass = 'text-[11px] font-medium text-muted-foreground';

export const editorInputClass =
  'h-9 bg-secondary/40 border-border/70 text-sm shadow-none focus-visible:ring-primary/40';

export const editorSelectTriggerClass =
  'h-9 bg-secondary/40 border-border/70 text-sm shadow-none';

export const editorTabRailClass =
  'shrink-0 flex flex-col items-center py-3 gap-0.5 border-r border-border/70 bg-[hsl(222_47%_5%)]';

export const editorTabButtonClass = (active: boolean) =>
  active
    ? 'relative bg-primary/15 text-primary ring-1 ring-primary/35 shadow-[0_0_20px_-8px_hsl(var(--primary)/0.5)]'
    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground';

export const editorPreviewStageClass =
  'relative flex-1 min-h-[min(42vh,420px)] flex items-center justify-center p-4 sm:p-6 bg-[radial-gradient(ellipse_at_center,hsl(222_30%_12%)_0%,hsl(222_47%_4%)_70%)]';

export const editorPreviewFrameClass =
  'relative w-full max-h-full overflow-hidden rounded-xl bg-black shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)] ring-1 ring-white/10';

export function formatEditorTimecode(seconds: number): string {
  const s = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const secStr = sec < 10 ? `0${sec.toFixed(1)}` : sec.toFixed(1);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${secStr.padStart(4, '0')}`;
  }
  return `${m}:${secStr.padStart(4, '0')}`;
}
