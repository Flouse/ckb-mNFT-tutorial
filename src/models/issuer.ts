import { assertHexString } from '@ckb-lumos/codec/lib/utils'
import { molecule, number } from '@ckb-lumos/codec'
import { hexify, bytifyRawString, concat } from '@ckb-lumos/codec/lib/bytes'
import { remove0x } from '../utils/hex'
import { HexString } from '@ckb-lumos/lumos';
import { DynTextCodec, JsonString } from '../types';

const { struct } = molecule
const { Uint8, Uint16BE, Uint32BE } = number

/**
 * The data structure of issuer cell
 * - version: uint8
 * - class_count: uint32
 * - set_count: uint32
 * - info_size: uint16
 * - info: infomation in json format
 * @see https://talk.nervos.org/t/rfc-multi-purpose-nft-draft-spec/5434/4
 * 
 * @property {Uint8} version
 * @property {Uint32} class_count
 * @property {Uint32} set_count
 * @property {Uint16} info_size
 */
export const NFTIssuerCellData = struct(
  {
    version: Uint8,
    classCount: Uint32BE,
    setCount: Uint32BE,
    infoSize: Uint16BE
  },
  ['version', 'classCount', 'setCount', 'infoSize']
)

type IssuerProps = {
  version: U8
  classCount: U32
  setCount: U32
  info: JsonString
}

class Issuer {
  version: U8 = 0
  classCount: U32 = 0
  setCount: U32 = 0
  /** the size of info: JsonString */
  infoSize: U16 = 0
  /**
   * suggested varible keys of the issuer's info:
   * - name: issuer’s name in UTF-8 encoding
   * - website: issuer’s website URL
   * - email: email address
   * - authentication: typically an SNS announcement about the issuance
   * - image: image URL for issuer
   */
  info: JsonString = ''
  constructor(version = 0, classCount = 0, setCount = 0, info: JsonString = '') {
    this.version = version
    this.classCount = classCount
    this.setCount = setCount
    this.infoSize = info.length
    this.info = info
  }

  toHexString(): HexString {
    const fixedPart: Uint8Array = NFTIssuerCellData.pack({
      version: this.version,
      classCount: this.classCount,
      setCount: this.setCount,
      infoSize: this.infoSize
    })
    const infoPart: Uint8Array = bytifyRawString(this.info)
    return `${hexify(concat(fixedPart, infoPart))}`
  }

  updateClassCount(count: U32) {
    this.classCount = count
  }

  updateInfo(info: JsonString) {
    this.info = info
  }

  static fromProps(props: IssuerProps): Issuer {
    const { version, classCount, setCount, info } = props
    return new Issuer(version, classCount, setCount, info)
  }

  static fromHexString(cellData: HexString) {
    assertHexString(cellData)
    cellData = remove0x(cellData)
    if (cellData.length < 18) { // FIXME: 18 -> NFTIssuerCellData.byteLength * 2
      throw new Error('Issuer data invalid')
    }

    const fixedPart = cellData.slice(0, NFTIssuerCellData.byteLength * 2)
    const fixeData = NFTIssuerCellData.unpack(fixedPart)
    const info: JsonString = DynTextCodec.unpack(cellData.slice((NFTIssuerCellData.byteLength - 2) * 2))

    return new Issuer(fixeData.version, fixeData.classCount, fixeData.setCount, info)
  }
}

export default Issuer
