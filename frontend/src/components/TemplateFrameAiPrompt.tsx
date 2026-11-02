import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Position = 'intro' | 'outro';

const INTRO_EXAMPLES = [
  {
    label: 'Luxury cinematic',
    prompt:
      'Luxury cinematic intro: deep navy and soft gold accents, elegant serif headline, warm lighting matching the video scene. Leave corners clear for logos.',
  },
  {
    label: 'Product launch',
    prompt:
      'High-energy product launch intro, dark background, large readable title, product hero center. Leave corners empty for logos.',
  },
  {
    label: 'Clean studio',
    prompt:
      'Clean bright studio intro, soft natural light, short tagline, minimal type matching the footage. Do not draw logos.',
  },
];

const OUTRO_EXAMPLES = [
  {
    label: 'Follow us',
    prompt:
      'Dark cinematic outro with a large Follow us moment, thank-you line, phone and website readable on mobile. Leave corners clear for logos.',
  },
  {
    label: 'Enquire now',
    prompt:
      'Polished end card over the real last shot, Enquire now button, contact phone and website. Leave corners empty for logos.',
  },
  {
    label: 'Thank you',
    prompt:
      'Thank-you outro matching the video lighting, soft close, contact details at the bottom. Do not invent logos.',
  },
];

export function TemplateFrameAiPrompt({
  position,
  value,
  onChange,
  disabled,
}: {
  position: Position;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const examples = position === 'intro' ? INTRO_EXAMPLES : OUTRO_EXAMPLES;
  const placeholder = position === 'intro'
    ? 'Describe only the intro, e.g. cinematic opening title matching the kitchen scene'
    : 'Describe only the outro, e.g. thank-you card with phone 95857499589 and Enquire now';

  return (
    <div className="space-y-2">
      <Label htmlFor={`${position}-ai-prompt`} className="text-sm font-semibold">
        AI prompt for {position}
      </Label>
      <p className="text-xs text-muted-foreground">
        Regenerating this {position} will not change the other frame.
      </p>
      <Textarea
        id={`${position}-ai-prompt`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        disabled={disabled}
        placeholder={placeholder}
        className="bg-secondary border-border resize-none text-sm"
      />
      <div className="flex flex-wrap gap-1.5">
        {examples.map((example) => (
          <button
            key={example.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(example.prompt)}
            className="text-[11px] px-2 py-1 rounded-full border border-border bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50"
          >
            {example.label}
          </button>
        ))}
      </div>
    </div>
  );
}
