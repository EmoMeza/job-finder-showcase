import {
  LLM_PROVIDER_LABELS,
  LLM_PROVIDERS,
  type LlmProvider,
  type LlmSettings,
} from '@job-finder/shared';
import { useState, type FormEvent } from 'react';
import { PortalsSection } from '@/components/settings/PortalsSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  useDeleteApiKey,
  useLlmSettings,
  useTestLlmConnection,
  useUpdateLlmSettings,
} from '@/lib/llm-settings';

const PROVIDER_DESCRIPTIONS: Record<LlmProvider, string> = {
  'claude-cli': 'Usa la suscripción de Claude configurada en el servidor. Sin costo por uso.',
  'anthropic-api': 'Usa tu propia API key de Anthropic. Se cobra por uso en tu cuenta.',
};

export function SettingsPage() {
  const settings = useLlmSettings();

  return (
    <section className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
      <PortalsSection />
      {settings.isPending && <p className="text-muted-foreground">Cargando…</p>}
      {settings.isError && <p className="text-destructive">No se pudo cargar la configuración.</p>}
      {/* `key` reinicia el formulario si cambian los datos guardados. */}
      {settings.data && (
        <LlmSettingsCard
          key={settings.data.provider + settings.data.apiKeyHint}
          settings={settings.data}
        />
      )}
    </section>
  );
}

function LlmSettingsCard({ settings }: { settings: LlmSettings }) {
  const [provider, setProvider] = useState<LlmProvider>(settings.provider);
  const [apiKey, setApiKey] = useState('');
  const update = useUpdateLlmSettings();
  const deleteKey = useDeleteApiKey();
  const test = useTestLlmConnection();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    test.reset();
    update.mutate({ provider, ...(apiKey.trim() && { apiKey: apiKey.trim() }) });
  }

  const unsaved = provider !== settings.provider || apiKey.trim() !== '';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proveedor de IA</CardTitle>
        <CardDescription>
          Se usa para generar tu perfil y evaluar qué tan compatibles son las ofertas contigo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <RadioGroup
            value={provider}
            onValueChange={(value) => setProvider(value as LlmProvider)}
            aria-label="Proveedor de IA"
          >
            {LLM_PROVIDERS.map((id) => (
              <div key={id} className="flex items-start gap-3">
                <RadioGroupItem value={id} id={`provider-${id}`} className="mt-0.5" />
                <Label htmlFor={`provider-${id}`} className="flex-col items-start gap-1">
                  <span>{LLM_PROVIDER_LABELS[id]}</span>
                  <span className="font-normal text-muted-foreground">
                    {PROVIDER_DESCRIPTIONS[id]}
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>

          {provider === 'claude-cli' && !settings.cliAvailable && (
            <Alert variant="destructive">
              <AlertDescription>
                El CLI de Claude no está instalado en el servidor.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="api-key">API key de Anthropic</Label>
            {settings.apiKeyHint && (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>
                  Guardada: <code>••••{settings.apiKeyHint}</code>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteKey.mutate()}
                  disabled={deleteKey.isPending}
                >
                  Eliminar
                </Button>
              </div>
            )}
            <Input
              id="api-key"
              type="password"
              autoComplete="off"
              placeholder={settings.apiKeyHint ? 'Ingresa una nueva para reemplazarla' : 'sk-ant-…'}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Se guarda cifrada y nunca se vuelve a mostrar completa.
            </p>
          </div>

          {update.isError && (
            <p role="alert" className="text-sm text-destructive">
              {update.error.message}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!unsaved || update.isPending}>
              {update.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => test.mutate()}
              disabled={unsaved || test.isPending}
              title={unsaved ? 'Guarda los cambios antes de probar' : undefined}
            >
              {test.isPending ? 'Probando…' : 'Probar conexión'}
            </Button>
          </div>

          {test.isSuccess && (
            <Alert>
              <AlertDescription>
                Conexión correcta con <strong>{test.data.model}</strong> en{' '}
                {(test.data.durationMs / 1000).toFixed(1)} s.
              </AlertDescription>
            </Alert>
          )}
          {test.isError && (
            <Alert variant="destructive">
              <AlertDescription>{test.error.message}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
