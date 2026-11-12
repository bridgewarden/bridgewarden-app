import { useCallback, useEffect, useState } from 'react';

import {
  DEFAULT_GENERATOR_PREFERENCES,
  generate,
  GeneratorPolicyError,
  type GeneratorOptions,
  type GeneratorPreferences,
  type GeneratorResult,
} from '~/lib/generator';
import { getGeneratorPreferences, setGeneratorPreferences } from '~/lib/generator-prefs';

const preferencesFor = (options: GeneratorOptions, current: GeneratorPreferences): GeneratorPreferences => ({
  ...current,
  mode: options.mode,
  [options.mode]: options,
});

export const useGenerator = () => {
  const [preferences, setPreferences] = useState<GeneratorPreferences>(DEFAULT_GENERATOR_PREFERENCES);
  const [result, setResult] = useState<GeneratorResult>(() => generate(DEFAULT_GENERATOR_PREFERENCES.password));
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const options = preferences.mode === 'password' ? preferences.password : preferences.passphrase;

  useEffect(() => {
    let active = true;
    void getGeneratorPreferences().then((saved) => {
      if (!active) return;
      setPreferences(saved);
      setResult(generate(saved.mode === 'password' ? saved.password : saved.passphrase));
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => void setGeneratorPreferences(preferences), 200);
    return () => window.clearTimeout(timer);
  }, [loaded, preferences]);

  const applyOptions = useCallback((next: GeneratorOptions) => {
    try {
      const generated = generate(next);
      setPreferences((current) => preferencesFor(next, current));
      setResult(generated);
      setError(null);
    } catch (cause) {
      setError(cause instanceof GeneratorPolicyError ? cause.message : 'invalid-policy');
    }
  }, []);

  const update = useCallback(
    (patch: Partial<GeneratorOptions>) => {
      applyOptions({ ...options, ...patch } as GeneratorOptions);
    },
    [applyOptions, options],
  );

  const setMode = useCallback(
    (mode: GeneratorOptions['mode']) => {
      const next = preferences[mode];
      setPreferences((current) => ({ ...current, mode }));
      setResult(generate(next));
    },
    [preferences],
  );

  const regenerate = useCallback(() => applyOptions(options), [applyOptions, options]);

  return {
    options,
    password: preferences.password,
    passphrase: preferences.passphrase,
    result,
    error,
    update,
    setMode,
    regenerate,
  };
};
