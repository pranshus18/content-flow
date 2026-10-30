import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Position = 'intro' | 'outro';

const INTRO_EXAMPLES = [
  {
    label: 'Luxury split intro',
    prompt: 'Luxury cinematic intro: navy branded panel on the left with the platform logo and a bold gold headline, product photo on the right, vendor logo in the executed-by bar.',
  },
  {
    label: 'Product launch',
    prompt: 'High-energy product launch intro, dark background, large “New Launch” title, product hero in the center, platform logo top-left and vendor logo top-right.',
  },
  {
    label: 'Clean studio',
    prompt: 'Clean white studio intro, soft lighting, product on a pedestal, platform logo bottom-left, short tagline at the top, no clutter.',
  },
];

const OUTRO_EXAMPLES = [
  {
    label: 'Follow us card',
    prompt: 'Dark cinematic outro, both logos, a large Follow us button in the center, phone number and website underneath, thank-you line at the top.',
  },
  {
    label: 'Enquire now',
    prompt: 'Polished end card over a blurred interior photo, platform logo large in the center, Enquire now button, contact phone, vendor logo in the corner.',
  },
  {
    label: 'Partner thank-you',
    prompt: 'Thank-you outro: “Executed by” with the vendor logo, then “In association with” and the platform logo, gold accents, readable on mobile.',
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
    ? 'Describe the intro you want, e.g. cinematic gold titles, navy panel with platform logo on the left, product photo on the right'
    : 'Describe the outro you want, e.g. dark thank-you card, Follow us button, both logos, phone and website at the bottom';

  return (
    <div className="space-y-2">
      <Label htmlFor={`${position}-ai-prompt`} className="text-sm font-semibold">
        AI prompt for this {position}
      </Label>
      <p className="text-xs text-muted-foreground">
        Write how this {position} should look. Generate with AI follows this description.
      </p>
      <Textarea
        id={`${position}-ai-prompt`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
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
