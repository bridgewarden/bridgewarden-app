import { redirect } from 'react-router';

import { t } from '~/lib/i18n/en';

export function loader() {
  return redirect('/app');
}

export const meta = () => [{ title: t('app.name') }, { name: 'description', content: t('app.tagline') }];
