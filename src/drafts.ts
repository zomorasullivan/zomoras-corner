type DraftFields = { title: string; summary: string; body: string };

export function serializeDraft(draft: DraftFields) {
  return JSON.stringify({
    Title: draft.title,
    'A Short Introduction': draft.summary,
    'Your Story': draft.body,
  }, null, 2) + '\n';
}

export function parseDraft(text: string): DraftFields {
  let data: unknown;
  try { data = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new Error('This file isn’t valid JSON. Choose a saved draft file.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Choose a draft with Title, A Short Introduction, and Your Story fields.');
  const fields = data as Record<string, unknown>;
  const title = fields.Title;
  const summary = fields['A Short Introduction'];
  const body = fields['Your Story'];
  if (typeof title !== 'string' || typeof summary !== 'string' || typeof body !== 'string') throw new Error('The draft needs text values for Title, A Short Introduction, and Your Story.');
  if (title.length > 160 || summary.length > 500 || body.length > 50000) throw new Error('This draft is too long: use up to 160 characters for the title, 500 for the introduction, and 50,000 for the story.');
  return { title, summary, body };
}
