// Hierarchical Deterministic (HD) wallet implementation of Lumos
import { Address, HexString, hd, helpers as lumosHelpers } from '@ckb-lumos/lumos'
import { TESTNET_SCRIPTS } from './config'

const { mnemonic, ExtendedPrivateKey, AddressType } = hd

/**
 * generate private key by HD mnemonic
 * @returns private key
 */
export const generateHDPrivateKey = () => {
  const seed = mnemonic.mnemonicToSeedSync(mnemonic.generateMnemonic())
  const extendedPrivKey = ExtendedPrivateKey.fromSeed(seed)
  return extendedPrivKey.privateKeyInfo(AddressType.Receiving, 0).privateKey
}

// get the address of CKB testnet from the private key
export const getAddressByPrivateKey = (privateKey: HexString): Address => {
  const args = hd.key.privateKeyToBlake160(privateKey)
  const template = TESTNET_SCRIPTS['SECP256K1_BLAKE160']
  const lockScript = {
    codeHash: template.CODE_HASH,
    hashType: template.HASH_TYPE,
    args: args,
  }

  return lumosHelpers.encodeToAddress(lockScript)
}
