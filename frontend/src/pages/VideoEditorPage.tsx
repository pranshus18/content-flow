import { useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { VideoEditorStudio } from '@/components/video-editor/VideoEditorStudio';
import { useContent } from '@/hooks/useContent';
import { resolveEditorPlatform } from '@/lib/editorTimeline';
import { Clapperboard, ChevronRight } from 'lucide-react';

export default function VideoEditorPage() {
  const [searchParams] = useSearchParams();
  const contentIdParam = searchParams.get('contentId') || '';
  const { contents, refetch, publishToSocial } = useContent();

  const linkedContent = useMemo(
    () => contents.find((c) => c.id === contentIdParam) || null,
    [contents, contentIdParam],
  );

  const replaceOptions = useMemo(
    () => contents.map((c) => ({ id: c.id, title: c.title, status: c.status })),
    [contents],
  );

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      <Sidebar onCreateClick={() => {}} isAdmin />
      <main className="flex-1 ml-64 flex flex-col h-screen min-h-0 min-w-0 overflow-hidden">
        <header className="shrink-0 border-b border-border/70 bg-card/35 backdrop-blur-xl px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Clapperboard className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-sm font-semibold tracking-tight truncate min-w-0">
              {linkedContent ? linkedContent.title : 'Video studio'}
            </h1>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Back to admin"
          >
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
          </Link>
        </header>
        <VideoEditorStudio
          layout="page"
          contentId={contentIdParam}
          mediaUrl={linkedContent?.media_url}
          mediaType={linkedContent?.media_type}
          initialPlatform={resolveEditorPlatform(linkedContent?.platform)}
          savedTimeline={linkedContent?.editor_timeline}
          replaceOptions={replaceOptions}
          linkedContent={linkedContent}
          captionOverride={linkedContent?.admin_description ?? undefined}
          platformOverride={linkedContent?.platform}
          onPublishContent={publishToSocial}
          onContentSynced={() => void refetch()}
          onSaved={() => void refetch()}
          onExportComplete={() => void refetch()}
          className="flex-1 min-h-0"
        />
      </main>
    </div>
  );
}
