import { Address, Script } from '@ckb-lumos/lumos'
import { createBytesCodec } from '@ckb-lumos/codec'
import { Uint8ArrayCodec } from '@ckb-lumos/codec/lib/base'

import { assertMinBufferLength, assertBufferLength, assertUtf8String } from '@ckb-lumos/codec/lib/utils'
import { Uint16BE } from '@ckb-lumos/codec/lib/number'
import { concat } from '@ckb-lumos/codec/lib/bytes'

export type U8 = number
export type U16 = number
export type U32 = number
export type JsonString = string

/** the length of vartext size(u16) */
const DYN_MIN_LEN = 2

/**
 * pack(encode) and unpack(decode) of dynamic text
 * 
 * dynamic text structure: <size:uint16> + <vartext>
 * @see https://talk.nervos.org/t/rfc-multi-purpose-nft-draft-spec/5434/4
 */
export const DynTextCodec = createBytesCodec(
  {
    pack: (rawString: string) => { // string or BytesLike ?
      assertUtf8String(rawString)
      const size = Uint16BE.pack(rawString.length)
      return concat(size, rawString)
    },
    unpack: (packed): JsonString => {
      assertMinBufferLength(packed, DYN_MIN_LEN)
      const size = Uint16BE.unpack(packed.slice(0, DYN_MIN_LEN))
      assertBufferLength(packed.slice(DYN_MIN_LEN), size)
      return String.fromCharCode(...packed.slice(DYN_MIN_LEN))
    }
  } as Uint8ArrayCodec
)

export type Account = {
  lockScript: Script
  address: Address
  pubKey: string
}

/**
 * The unit of capacity in CKB is Shannon, 1CKB = 10^8 Shannon
 * See https://docs.nervos.org/docs/basics/glossary#shannon
 */
export enum CapacityUnit {
  Shannon = 1,
  Byte = 100000000,
}
