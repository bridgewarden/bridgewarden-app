export type EditorType = 'login' | 'note';

export type CustomFieldForm = {
  label: string;
  value: string;
  hidden: boolean;
};

export type EditorValues = {
  type: EditorType;
  name: string;
  folderId: string;
  favorite: boolean;
  username: string;
  password: string;
  urls: string[];
  notes: string;
  totpSecret: string;
  customFields: CustomFieldForm[];
  body: string;
};

export type EditorErrors = Partial<
  Record<
    'name' | 'username' | 'password' | 'urls' | 'notes' | 'totpSecret' | 'customFields' | 'body' | 'payload',
    string
  >
>;
