/** Built-in sticker palette (CapCut-style emoji stickers). */
export const EDITOR_STICKER_EMOJIS = [
  '🔥', '✨', '💯', '👍', '❤️', '😂', '🎉', '⭐', '💡', '🚀',
  '📣', '✅', '👀', '💪', '🙌', '👏', '🎯', '💥', '⚡', '🌟',
  '😍', '🤩', '😎', '🥳', '🤔', '👋', '🫶', '💬', '📌', '🏆',
] as const;

export type EditorStickerEmoji = (typeof EDITOR_STICKER_EMOJIS)[number];
