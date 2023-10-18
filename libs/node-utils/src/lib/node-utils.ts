import { Buffer } from 'buffer';
import {
  compress as compressZstd,
  decompress as decompressZstd,
} from '@mongodb-js/zstd';
import {
  compress as compressBrotli,
  decompress as decompressBrotli,
} from 'brotli-wasm';
import { createHash } from 'node:crypto';

export const bytesToMbs = (bytes: number) => Math.round(bytes / 10) / 100000;

export type CompressionAlgorithm = 'brotli' | 'zstd';

export const compressStringBrotli = async (string: string) => {
  const stringBuffer = Buffer.from(string);

  return Buffer.from(compressBrotli(stringBuffer));
};

export const compressStringZstd = async (string: string, level = 9) => {
  const stringBuffer = Buffer.from(string);

  return await compressZstd(stringBuffer, level);
};

export const compressString = async (
  string: string | Buffer,
  algorithm: CompressionAlgorithm = 'zstd',
) => {
  const stringBuffer = string instanceof Buffer ? string : Buffer.from(string);

  switch (algorithm) {
    case 'brotli':
      return Buffer.from(compressBrotli(stringBuffer));
    case 'zstd':
      return Buffer.from(await compressZstd(stringBuffer));
    default:
      return Buffer.from(await compressZstd(stringBuffer));
  }
};

export const decompressStringBrotli = async (compressed: Buffer) =>
  Buffer.from(decompressBrotli(compressed)).toString('utf-8');

export const decompressStringZstd = async (compressed: Buffer) =>
  (await decompressZstd(compressed)).toString('utf-8');

export const decompressString = async (
  string: string | Buffer,
  algorithm: CompressionAlgorithm = 'zstd',
) => {
  const stringBuffer = string instanceof Buffer ? string : Buffer.from(string);

  switch (algorithm) {
    case 'brotli':
      return Buffer.from(decompressBrotli(stringBuffer)).toString('utf-8');
    case 'zstd':
      return (await decompressZstd(stringBuffer)).toString('utf-8');
    default:
      return (await decompressZstd(stringBuffer)).toString('utf-8');
  }
};

export const md5Hash = (target: string | object) =>
  createHash('md5')
    .update(typeof target === 'string' ? target : JSON.stringify(target))
    .digest('hex');
