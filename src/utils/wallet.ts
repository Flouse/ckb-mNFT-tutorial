import { Hash, RPC, Address, HexString, hd, helpers as lumosHelpers } from '@ckb-lumos/lumos'
import { TransactionSkeletonType, sealTransaction } from '@ckb-lumos/helpers'
import { common as commonScriptHelper } from '@ckb-lumos/common-scripts'
import { CKB_NODE_RPC, TESTNET_SCRIPTS } from './config'

// Hierarchical Deterministic (HD) wallet implementation of Lumos
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

/** sign the prepared transaction skeleton, then send it to a CKB node. */
export const signAndSendTx = async (
  txSkeleton: TransactionSkeletonType,
  privateKey: HexString,
): Promise<Hash> => {
  txSkeleton = commonScriptHelper.prepareSigningEntries(txSkeleton);

  const message = txSkeleton.get('signingEntries').get(0)?.message;

  // sign the transaction with the private key
  const sig = hd.key.signRecoverable(message!, privateKey);
  const signedTx = sealTransaction(txSkeleton, [sig]);

  // create a new RPC instance pointing to CKB testnet
  const rpc = new RPC(CKB_NODE_RPC);

  // send the transaction to CKB node
  const txHash = await rpc.sendTransaction(signedTx);
  return txHash;
}
