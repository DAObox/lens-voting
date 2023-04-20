export function bytesToHex(buff: Uint8Array, skip0x?: boolean): string {
  const bytes: string[] = [];
  for (let i = 0; i < buff.length; i++) {
    if (buff[i] >= 16) bytes.push(buff[i].toString(16));
    else bytes.push('0' + buff[i].toString(16));
  }
  if (skip0x) return bytes.join('');
  return '0x' + bytes.join('');
}

export function hexToBytes(hexString: string): Uint8Array {
  if (!hexString) return new Uint8Array();
  else if (!/^(0x)?[0-9a-fA-F]*$/.test(hexString)) {
    throw new Error('Invalid hex string');
  } else if (hexString.length % 2 !== 0) {
    throw new Error('The hex string has an odd length');
  }

  hexString = strip0x(hexString);
  const bytes = [];
  for (let i = 0; i < hexString.length; i += 2) {
    bytes.push(parseInt(hexString.substring(i, i + 2), 16));
  }
  return Uint8Array.from(bytes);
}

export function strip0x(value: string): string {
  return value.startsWith('0x') ? value.substring(2) : value;
}
