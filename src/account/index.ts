// TODO: rm ckb-sdk-core
import { CellDep, Script } from '@ckb-lumos/base'
import { HexString, RPC, hd, helpers as lumosHelpers } from '@ckb-lumos/lumos'
import { Account } from '../types'
import { CKB_NODE_RPC_URL, PRIVATE_KEY, RECEIVER_ADDRESS, TESTNET_SCRIPTS } from '../utils/config'

const ckb = new RPC(CKB_NODE_RPC_URL)

/**
 * generate an Account from the private key
 * @param privKey the account's private key
 * @returns
 */
export const generateAccountFromPrivateKey = (privKey: HexString): Account => {
  const pubKey = hd.key.privateToPublic(privKey)
  const args = hd.key.publicKeyToBlake160(pubKey)
  const template = TESTNET_SCRIPTS['SECP256K1_BLAKE160']
  const lockScript = {
    codeHash: template.CODE_HASH,
    hashType: template.HASH_TYPE,
    args: args,
  }
  const address = lumosHelpers.encodeToAddress(lockScript)

  return {
    lockScript,
    address,
    pubKey,
  }
}

// TODO: use lumos lib function
// export const secp256k1LockScript = async (): Promise<Script> => {
//   const secp256k1Dep = (await ckb.loadDeps()).secp256k1Dep
//   return {
//     codeHash: secp256k1Dep.codeHash,
//     hashType: secp256k1Dep.hashType,
//     args: generateLockArgs(PRIVATE_KEY),
//   }
// }

// export const generateLockArgs = (privateKey: HexString) => {
//   const pubKey = ckb.utils.privateKeyToPublicKey(privateKey)
//   return '0x' + ckb.utils.blake160(pubKey, 'hex')
// }

// export const receiverLockScript = (): Script => {
//   return lumosHelpers.addressToScript(RECEIVER_ADDRESS)
// }

export const alwaysSuccessLock = (): Script => ({
  codeHash: '0x1157470ca9de091c21c262bf0754b777f3529e10d2728db8f6b4e04cfc2fbb5f',
  hashType: 'data',
  args: '0x',
})

export const alwaysSuccessCellDep = (): CellDep => ({
  outPoint: {
    txHash: '0x46a7625a76cf7401eff1dfe4f46138be69316518c9771c9f780a428843c6b5b1',
    index: '0x0',
  },
  depType: 'code',
})
