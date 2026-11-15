import { useEffect, useRef, type Dispatch } from 'react';
import { useFetcher, useNavigate } from 'react-router';

import { storeKeyMaterial } from '~/lib/vault/key-material';
import { clearVaultKey } from '~/lib/vault/key-store';

import { toSetupPayload } from '../../../lib/crypto/setup-keys';
import type { SetupAction, SetupActionResponse, SetupState } from '../setup.types';

type SetupSubmissionOptions = {
  state: SetupState;
  dispatch: Dispatch<SetupAction>;
};

export const useSetupSubmission = ({ state, dispatch }: SetupSubmissionOptions) => {
  const fetcher = useFetcher<SetupActionResponse>();
  const navigate = useNavigate();
  const wasSubmitting = useRef(false);

  useEffect(() => {
    if (!fetcher.data) return;

    if (fetcher.data.ok) {
      const keys = state.keys;
      if (keys) {
        void storeKeyMaterial(state.email, keys).catch(() => undefined);
      }
      dispatch({ type: 'succeeded' });
      return;
    }

    if (fetcher.data.error === 'forbidden' || fetcher.data.error === 'already-configured') {
      clearVaultKey();
    }

    dispatch({ type: 'failed', error: fetcher.data.error });
  }, [fetcher.data, state.email, state.keys, dispatch]);

  useEffect(() => {
    if (state.step === 'done' && fetcher.state === 'idle') {
      navigate('/app', { replace: true });
    }
  }, [state.step, fetcher.state, navigate]);

  useEffect(() => {
    if (fetcher.state !== 'idle') {
      wasSubmitting.current = true;
      return;
    }

    if (wasSubmitting.current && state.step === 'submitting' && !fetcher.data) {
      dispatch({ type: 'failed', error: 'network' });
    }

    wasSubmitting.current = false;
  }, [fetcher.state, state.step, fetcher.data, dispatch]);

  const submitSetup = () => {
    if (!state.keys) return;

    fetcher.submit(toSetupPayload(state.keys, { email: state.email, displayName: state.displayName }), {
      method: 'post',
      encType: 'application/json',
    });
  };

  const continueTwoFactor = () => {
    dispatch({ type: 'two-factor-continued' });
    submitSetup();
  };

  const retry = () => {
    dispatch({ type: 'retry' });
    submitSetup();
  };

  return {
    busy: fetcher.state !== 'idle' || state.step === 'submitting',
    continueTwoFactor,
    retry,
  };
};
