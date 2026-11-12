import { createContext } from 'react-router';

export type SecurityContext = {
  nonce: string;
};

export const securityContext = createContext<SecurityContext>();
