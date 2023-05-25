import { createBytesCodec } from '@ckb-lumos/codec'
import { Uint8ArrayCodec } from '@ckb-lumos/codec/lib/base'

import { assertMinBufferLength, assertBufferLength, assertUtf8String } from '@ckb-lumos/codec/lib/utils'
import { Uint16LE } from '@ckb-lumos/codec/lib/number'
import { concat, hexify } from '@ckb-lumos/codec/lib/bytes'

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
      const size = Uint16LE.pack(rawString.length)
      return concat(size, rawString)
    },
    unpack: (packed): JsonString => {
      assertMinBufferLength(packed, DYN_MIN_LEN)
      const size = Uint16LE.unpack(packed.slice(0, DYN_MIN_LEN))
      assertBufferLength(packed.slice(DYN_MIN_LEN), size)
      return packed.slice(DYN_MIN_LEN).toString()
    }
  } as Uint8ArrayCodec
)
