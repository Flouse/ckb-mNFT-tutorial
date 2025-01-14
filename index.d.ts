/// <reference types="@nervosnetwork/ckb-types" />
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let TextEncoder: any, TextDecoder: any

type Hex = string
type DynHex = string // <size: u16> + <content>

type UpdateNFTProps = {
  extInfo?: DynHex
  characteristic?: U8[]
  issuerOutPoint?: OutPoint
  classOutPoint?: OutPoint
  state?: Hex
}

type NftIssuerProps = {
  issuerOutPoint: OutPoint
  nftOutPoints: OutPoint[]
}

type NftClassProps = {
  classOutPoint: OutPoint
  nftOutPoints: OutPoint[]
}

type TokenClassProps = {
  version: U8
  total: U32
  issued: U32
  configure: Hex
  name: DynHex
  description: DynHex
  renderer: DynHex
  extinfoData?: DynHex
}

type NftProps = {
  version: U8
  characteristic: U8[]
  configure: Hex
  state: Hex
  extinfoData: DynHex
}
