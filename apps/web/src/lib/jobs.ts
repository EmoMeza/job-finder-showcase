import type { JobSummary } from '@job-finder/shared';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export const JOBS_KEY = ['jobs'] as const;

export function useJobs() {
  return useQuery({ queryKey: JOBS_KEY, queryFn: () => apiGet<JobSummary[]>('/jobs') });
}
