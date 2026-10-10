import type { LlmSettings, LlmTestResult, UpdateLlmSettingsRequest } from '@job-finder/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api';
import { SESSION_QUERY_KEY } from '@/lib/auth';

const LLM_SETTINGS_KEY = ['settings', 'llm'] as const;

export function useLlmSettings() {
  return useQuery({
    queryKey: LLM_SETTINGS_KEY,
    queryFn: () => apiGet<LlmSettings>('/settings/llm'),
  });
}

/** Al guardar se actualiza la caché de la configuración y de la sesión (incluye el proveedor). */
function useSettingsMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<LlmSettings>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (settings) => {
      queryClient.setQueryData(LLM_SETTINGS_KEY, settings);
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
}

export function useUpdateLlmSettings() {
  return useSettingsMutation((body: UpdateLlmSettingsRequest) =>
    apiPut<LlmSettings>('/settings/llm', body),
  );
}

export function useDeleteApiKey() {
  return useSettingsMutation(() => apiDelete<LlmSettings>('/settings/llm/api-key'));
}

export function useTestLlmConnection() {
  return useMutation({
    mutationFn: () => apiPost<LlmTestResult>('/settings/llm/test'),
  });
}
