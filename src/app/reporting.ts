import project from '../../project.config.json';

// Only an explicitly configured public repository is a reporting destination.
export const REPOSITORY_URL: string | null = project.repository;
export const SUBMISSION_GUIDE_URL = REPOSITORY_URL
  ? `${REPOSITORY_URL}/blob/main/docs/result-submissions.md` : './docs/result-submissions.md';
export const researchRoutes = ['accepted-paper', 'lean-formalization', 'preprint'] as const;
export const submissionRoutes = [...researchRoutes, 'data-correction', 'website-feedback'] as const;
export type SubmissionRoute = typeof submissionRoutes[number];

export function submissionUrl(route: SubmissionRoute): string | null {
  if (!REPOSITORY_URL) return null;
  const url = new URL(`${REPOSITORY_URL}/issues/new`);
  url.searchParams.set('template', `${route}.yml`);
  return url.toString();
}
