import { useEffect, useState } from 'react';
import { useFetcher, useNavigate, useSearchParams } from 'react-router';

import { useRecoveryActions } from '~/hooks/use-recovery-actions';
import { isMasterPasswordAcceptable, passwordScore } from '~/lib/password-policy';

import { generateSetupKeyMaterial, type SetupTransportMaterial } from '../../lib/crypto/setup-keys';
import { normalizeRecoveryKey } from '../../lib/crypto/recovery';
import { storeKeyMaterial } from '../../lib/vault/key-material';
import { setVaultKey, clearVaultKey } from '../../lib/vault/key-store';

import type { MemberSetupError } from './member-setup.constants';

export const useMemberSetup = (email: string) => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const fetcher = useFetcher<{ ok: true } | { ok: false; error: MemberSetupError }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [material, setMaterial] = useState<SetupTransportMaterial | null>(null);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<MemberSetupError | null>(null);
  const [deriving, setDeriving] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloaded' | 'failed'>('idle');

  useEffect(() => {
    if (fetcher.data?.ok) {
      if (material) {
        void storeKeyMaterial(email, material).catch(() => undefined);
      }
      navigate('/app', { replace: true });
    }
    if (fetcher.data && !fetcher.data.ok) clearVaultKey();
  }, [email, fetcher.data, material, navigate]);

  const generate = async () => {
    if (deriving) return;
    if (!isMasterPasswordAcceptable(password)) {
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

  const { copyRecoveryKey, downloadRecoveryKey } = useRecoveryActions({
    recoveryKey,
    setCopyStatus,
    setDownloadStatus,
  });

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

  const backToPassword = () => {
    clearVaultKey();
    setMaterial(null);
    setRecoveryKey('');
    setConfirmation('');
    setPassword('');
    setConfirmPassword('');
    setCopyStatus('idle');
    setDownloadStatus('idle');
    setError(null);
  };

  return {
    token,
    password,
    confirmPassword,
    material,
    recoveryKey,
    confirmation,
    error: error ?? (material && fetcher.data && !fetcher.data.ok ? fetcher.data.error : null),
    busy: fetcher.state !== 'idle' || deriving,
    deriving,
    score: passwordScore(password),
    copyStatus,
    downloadStatus,
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
    copyRecoveryKey,
    downloadRecoveryKey,
    backToPassword,
    generate,
    submit,
  };
};
