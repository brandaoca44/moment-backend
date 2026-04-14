// src/common/utils/extract-mentions.util.ts
export function extractMentions(content: string): string[] {
  const regex = /(?:^|[\s.,!?;:()"'\-])@([a-zA-Z0-9._]{3,30})/g;
  const usernames = new Set<string>();

  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const username = match[1]?.toLowerCase();

    if (username) {
      usernames.add(username);
    }
  }

  return [...usernames];
}