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
})
