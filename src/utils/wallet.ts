import { Hash, RPC, Address, HexString, hd, helpers as lumosHelpers, WitnessArgs } from '@ckb-lumos/lumos'
import { blockchain } from '@ckb-lumos/base'
import { TransactionSkeletonType, sealTransaction } from '@ckb-lumos/helpers'
import { hexify } from '@ckb-lumos/codec/lib/bytes'
import { common as commonScriptHelper } from '@ckb-lumos/common-scripts'
import { CKB_NODE_RPC, TESTNET_SCRIPTS } from './config'
import { CapacityUnit } from '../types'

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

/**
 * add the first witness for the fromAddress script,
 * which has a WitnessArgs constructed with 65-byte zero filled values
 */
export function addWitness(
  txSkeleton: lumosHelpers.TransactionSkeletonType,
  // _fromScript: Script
): lumosHelpers.TransactionSkeletonType {
  const firstLockInputIndex = 0

  /** 65-byte zeros in hex */
  const SECP_SIGNATURE_PLACEHOLDER =
    "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
  const newWitnessArgs: WitnessArgs = { lock: SECP_SIGNATURE_PLACEHOLDER }
  const witness = hexify(blockchain.WitnessArgs.pack(newWitnessArgs))

  return txSkeleton.update("witnesses", (witnesses) =>
    witnesses.set(firstLockInputIndex, witness)
  )
}

export const sumOfCapacity = (acc, input) => acc + BigInt(input.cellOutput.capacity)

const validateTransaction = (txSkeleton: TransactionSkeletonType) => {
  const inputs = txSkeleton.get('inputs')
  const sumOfInputCapacity = inputs.reduce(sumOfCapacity, 0n)
  const outputs = txSkeleton.get('outputs')
  const sumOfOutputCapacity = outputs.reduce(sumOfCapacity, 0n)

  if (sumOfInputCapacity <= sumOfOutputCapacity)
    throw new Error('Insufficient capacity')
  if (sumOfInputCapacity - sumOfOutputCapacity >= CapacityUnit.Byte)
    throw new Error("Warning: too much transaction fee")
}

/** sign the prepared transaction skeleton, then send it to a CKB node. */
export const signAndSendTx = async (
  txSkeleton: TransactionSkeletonType,
  privateKey: HexString,
): Promise<Hash> => {
  validateTransaction(txSkeleton)

  txSkeleton = commonScriptHelper.prepareSigningEntries(txSkeleton)
  const message = txSkeleton.get('signingEntries').get(0)?.message

  // sign the transaction with the private key
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const sig = hd.key.signRecoverable(message!, privateKey)
  const signedTx = sealTransaction(txSkeleton, [sig])

  // TODO: write debug log to file
  console.debug(`txSkeleton: ${JSON.stringify(signedTx, undefined, 2)}`)

  // create a new RPC instance pointing to CKB testnet
  const rpc = new RPC(CKB_NODE_RPC)

  // send the transaction to CKB node
  const txHash = await rpc.sendTransaction(signedTx)
  return txHash;
}
