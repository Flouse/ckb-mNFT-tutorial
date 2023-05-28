import { describe, expect, test } from '@jest/globals'
import { bytify } from '@ckb-lumos/codec/lib/bytes'
import Issuer, { NFTIssuerCellData } from './issuer'

describe('Test NFT Issuer model', () => {
  test('NFTIssuerCellData.byteLength', () => {
    expect(NFTIssuerCellData.byteLength).toBe(1 + 4 + 4 + 2)
  })

  test('NFTIssuerCellData.unpack', () => {
    expect(NFTIssuerCellData.unpack('0x0000000001000000010000')).toEqual({
      version: 0,
      classCount: 1,
      setCount: 1,
      infoSize: 0,
    })
  })

  test('NFTIssuerCellData.pack', () => {
    expect(NFTIssuerCellData.pack({
      version: 0,
      classCount: 2,
      setCount: 1,
      infoSize: 0
    })).toEqual(bytify('0x0000000002000000010000'))
  })

  test('Issuer.toHexString', () => {
    const issuer1 = Issuer.fromProps({
      version: 0,
      classCount: 2,
      setCount: 1,
      info: 'ab'
    })
    expect(issuer1.toHexString()).toBe('0x00000000020000000100026162')

    const issuer2 = new Issuer(0, 1, 2, 'a')
    expect(issuer2.toHexString()).toBe('0x000000000100000002000161')
  })

  test('Issuer.fromHexString', () => {
    // https://pudge.explorer.nervos.org/transaction/0x8b0b6c50e8cdd6429d09b2d625307468d17499874004cb73bc9af05cb5dee588
    const issuerData = Issuer.fromHexString('0x00000000000000000000da7b226e616d65223a22416c696365222c2277656273697465223a2268747470733a2f2f70756467652e6578706c6f7265722e6e6572766f732e6f72672f6e66742d636f6c6c656374696f6e73222c22656d61696c223a226e6f626f6479406e6572766f736e6574776f726b2e636b62222c22696d616765223a2268747470733a2f2f6c65786963612d73657276652d656e636f6465642d696d616765732e7368617269662e776f726b6572732e6465762f736d2f30383130376637632d306464302d346237312d393133632d643533653134653734646439227d')
    expect(issuerData).toEqual(
      Issuer.fromProps({
        version: 0,
        classCount: 0,
        setCount: 0,
        info: JSON.stringify({
          name: 'Alice',
          website: 'https://pudge.explorer.nervos.org/nft-collections',
          email: 'nobody@nervosnetwork.ckb',
          image: 'https://lexica-serve-encoded-images.sharif.workers.dev/sm/08107f7c-0dd0-4b71-913c-d53e14e74dd9'
        })
      })
    )
  })
})
