import {BytesLike, ethers} from 'ethers';
import {Web3Storage, File} from 'web3.storage';
import {Buffer} from 'buffer';

export async function uploadToIPFS(text: string): Promise<string> {
  // Read the access token from the environment variable
  const accessToken = process.env.WEB_3_STORAGE_KEY;

  if (!accessToken) {
    throw new Error('WEB_3_STORAGE_KEY environment variable not set');
  }

  // Create a Web3Storage client instance
  const client = new Web3Storage({token: accessToken});

  // Convert the string to a Buffer
  const textBuffer = Buffer.from(text);

  // Create a File object with the text buffer
  const file = new File([textBuffer], '');

  // Store the File object on web3.storage without wrapping it in a directory
  return await client.put([file], {wrapWithDirectory: false});
}

export function toHex(input: string): BytesLike {
  return ethers.utils.hexlify(ethers.utils.toUtf8Bytes(input));
}
