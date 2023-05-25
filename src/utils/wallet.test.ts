import { beforeAll, describe, expect, test } from '@jest/globals'
import dotenv from 'dotenv'
import { generateHDPrivateKey, getAddressByPrivateKey } from './wallet'
import { Address, HexString } from '@ckb-lumos/lumos'

describe('Test utils/wallet', () => {
  let privateKey: HexString
  let cktAddr: Address

  beforeAll(() => {
    dotenv.config()
    privateKey = process.env.PRIVATE_KEY
    expect(privateKey).toBeDefined()
  })

  test('generateHDPrivateKey', () => {
    expect(generateHDPrivateKey()).toMatch(/^0x([0-9a-fA-F][0-9a-fA-F]){32}$/)
  })

  test('getAddressByPrivateKey', () => {
    cktAddr = getAddressByPrivateKey(privateKey)
    expect(cktAddr).toMatch(/^ckt*/)
    // expect(address).toBe(process.env.RECEIVER_ADDRESS)
  })

  test('get faucet', () => {
    expect(true).toBe(false)
  })

  // TODO
  // transfer all CKB capacity back to faucet pool
})
