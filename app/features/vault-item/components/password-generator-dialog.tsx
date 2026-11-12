import { GeneratorPanel } from '~/components/generator-panel';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { t } from '~/lib/i18n/en';

type PasswordGeneratorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (value: string) => void;
};

export const PasswordGeneratorDialog = ({ open, onOpenChange, onApply }: PasswordGeneratorDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{t('generator.dialogTitle')}</DialogTitle>
        <DialogDescription>{t('generator.dialogDescription')}</DialogDescription>
      </DialogHeader>
      <GeneratorPanel showStandaloneLink onApply={onApply} />
    </DialogContent>
  </Dialog>
);
