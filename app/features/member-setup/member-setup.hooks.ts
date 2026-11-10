import { useEffect, useState } from 'react';
import { useFetcher, useNavigate, useSearchParams } from 'react-router';

import { generateSetupKeyMaterial, type SetupTransportMaterial } from '../../lib/crypto/setup-keys';
import { normalizeRecoveryKey } from '../../lib/crypto/recovery';
import { MIN_MASTER_PASSWORD_LENGTH } from '../../lib/password-policy';
import { setVaultKey, clearVaultKey } from '../../lib/vault/key-store';

export const useMemberSetup = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const fetcher = useFetcher<{ ok: true } | { ok: false; error: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [material, setMaterial] = useState<SetupTransportMaterial | null>(null);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deriving, setDeriving] = useState(false);

  useEffect(() => {
    if (fetcher.data?.ok) navigate('/app', { replace: true });
    if (fetcher.data && !fetcher.data.ok) clearVaultKey();
  }, [fetcher.data, navigate]);

  const generate = async () => {
    if (deriving) return;
    if (password.length < MIN_MASTER_PASSWORD_LENGTH) {
      setError('password');
      return;
    }
    if (password !== confirmPassword) {
      setError('mismatch');
      return;
    }

    setError(null);
    setDeriving(true);
    try {
      const generated = await generateSetupKeyMaterial(password);
      const { vaultKey, recoveryKey: recovery, ...transport } = generated;
      setVaultKey(vaultKey);
      vaultKey.fill(0);
      setMaterial(transport);
      setRecoveryKey(recovery);
      setPassword('');
      setConfirmPassword('');
    } catch {
      setError('server');
    } finally {
      setDeriving(false);
    }
  };

  const submit = () => {
    if (!material) return;
    const expected = normalizeRecoveryKey(recoveryKey).slice(0, 6);
    if (normalizeRecoveryKey(confirmation).slice(0, 6) !== expected) {
      setError('recovery');
      return;
    }
    setError(null);
    fetcher.submit({ token, ...material }, { method: 'post', action: '/setup/member', encType: 'application/json' });
  };

  return {
    token,
    password,
    confirmPassword,
    material,
    recoveryKey,
    confirmation,
    error: error ?? (fetcher.data && !fetcher.data.ok ? fetcher.data.error : null),
    busy: fetcher.state !== 'idle' || deriving,
    deriving,
    changePassword: (value: string) => {
      setPassword(value);
      setError(null);
    },
    changeConfirmPassword: (value: string) => {
      setConfirmPassword(value);
      setError(null);
    },
    changeConfirmation: (value: string) => {
      setConfirmation(value);
      setError(null);
    },
    generate,
    submit,
  };
};
