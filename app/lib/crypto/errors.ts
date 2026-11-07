export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class WrongPasswordError extends CryptoError {
  constructor() {
    super('Incorrect password or corrupted key material');
  }
}

export class InvalidRecoveryKeyError extends CryptoError {
  constructor() {
    super('Invalid recovery key');
  }
}

export class MalformedEnvelopeError extends CryptoError {
  constructor() {
    super('Malformed encrypted envelope');
  }
}

export class UnsupportedEnvelopeError extends CryptoError {
  constructor() {
    super('Unsupported encrypted format');
  }
}

export class InvalidEncodingError extends CryptoError {
  constructor() {
    super('Invalid base64 value');
  }
}

export class InvalidKdfParamsError extends CryptoError {
  constructor() {
    super('Invalid key derivation parameters');
  }
}

export class InvalidKeyMaterialError extends CryptoError {
  constructor() {
    super('Invalid key material');
  }
}

export class InvalidPayloadError extends CryptoError {
  constructor() {
    super('Invalid payload');
  }
}
