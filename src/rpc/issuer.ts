import CKB from '@nervosnetwork/ckb-sdk-core'
import { serializeInput, blake2b, hexToBytes } from '@nervosnetwork/ckb-sdk-utils'

import { HexString, Cell, Input, Script, Hash, hd, RPC, Indexer } from '@ckb-lumos/lumos'
import { minimalScriptCapacity, TransactionSkeleton, TransactionSkeletonType } from '@ckb-lumos/helpers'
import { common as lumosHelper } from '@ckb-lumos/common-scripts'
import { sealTransaction } from '@ckb-lumos/helpers'

import {
  secp256k1LockScript,
  secp256k1Dep,
  alwaysSuccessLock,
  alwaysSuccessCellDep,
  receiverLockScript,
} from '../account'
import { getCells, getLiveCell } from '../collector'
import { FEE, IssuerTypeScript, IssuerTypeDep } from '../constants/script'
import { CKB_NODE_RPC, PRIVATE_KEY, TESTNET_SCRIPTS } from '../utils/config'
import { u64ToLe } from '../utils/hex'
import Issuer from '../models/issuer'
import { ckbIndexer } from '../collector/lumos-indexer'
import { log } from 'console'


const ckb = new CKB(CKB_NODE_RPC)
const ISSUER_CELL_CAPACITY = BigInt(150) * BigInt(100000000)
// TODO: explain personal(b"ckb-default-hash")
const PERSONAL = new Uint8Array([99, 107, 98, 45, 100, 101, 102, 97, 117, 108, 116, 45, 104, 97, 115, 104])

/**
 * see https://github.com/nervina-labs/ckb-nft-scripts/blob/v0.4.0/contracts/issuer-type/src/entry.rs#L32-L40
 */
const generateIssuerTypeArgs = (firstInput: Input, firstOutputIndex: bigint) => {
  const input = hexToBytes(serializeInput(firstInput))
  const s = blake2b(32, null, null, PERSONAL)
  s.update(input)
  s.update(hexToBytes(`0x${u64ToLe(firstOutputIndex)}`))
  return `0x${s.digest('hex').slice(0, 40)}`
}

/** sign the prepared transaction skeleton, then send it to a CKB node. */
const signAndSendTx = async (
  txSkeleton: TransactionSkeletonType,
  privateKey: HexString,
): Promise<Hash> => {
  txSkeleton = lumosHelper.prepareSigningEntries(txSkeleton);

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

/**
 * TODO: createIssuerCell in GitHub Action
 */
export const createIssuerCell = async () => {
  // FIXME: secp256k1LockScript
  const lock = await secp256k1LockScript()
  const _type: Script | undefined = undefined

  // FAQ: How do you set the value of capacity in a Cell?
  // See: https://docs.nervos.org/docs/essays/faq/#how-do-you-set-the-value-of-capacity-in-a-cell
  const minimalCellCapacity = minimalScriptCapacity(lock) + 800000000n
  const requiredCapacity = ISSUER_CELL_CAPACITY + minimalCellCapacity

  const inputCells = await getCells(lock, _type, requiredCapacity)
  // const collectedCapacity = inputCells.reduce((acc: bigint, cell: Cell) => {
  //   return acc + BigInt(cell.cellOutput.capacity)
  // }, 0n)

  const firstInput: Input = { previousOutput: inputCells[0].outPoint, since: '0x0' }
  const issuerTypeArgs = generateIssuerTypeArgs(firstInput, BigInt(0))

  const targetOutput: Cell = {
    cellOutput: {
      capacity: `0x${ISSUER_CELL_CAPACITY.toString(16)}`,
      lock,
      type: { ...IssuerTypeScript, args: issuerTypeArgs },
    },
    data: Issuer.fromProps({ version: 0, classCount: 0, setCount: 0, info: '' }).toString()
  }

  let txSkeleton = TransactionSkeleton({
    cellProvider: ckbIndexer
  })
  // txSkeleton = txSkeleton.update('inputs', inputs => inputs.push(...inputCells))
  txSkeleton = txSkeleton.update('cellDeps', deps => deps.push(IssuerTypeDep))
  txSkeleton = txSkeleton.update('outputs', outputs => outputs.push(targetOutput))
  txSkeleton = txSkeleton.update('fixedEntries', fes => fes.push({
    field: 'outputs', index: 0
  }))
  txSkeleton = await lumosHelper.injectCapacity(txSkeleton, [{ script: lock, customData: '' }], ISSUER_CELL_CAPACITY)
  txSkeleton = await lumosHelper.payFeeByFeeRate(
    txSkeleton,
    [{ script: lock, customData: '' }],
    // ['ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqtjh0r4x3y5ueq8lmph7wsqfrr0wm4l30qu7e0qg'], 
    2000,
    // undefined,
    // { enableDeductCapacity:  }
  )
  

  console.debug(`txSkeleton: ${JSON.stringify(txSkeleton, undefined, 2)}`);

  const txHash = await signAndSendTx(txSkeleton, PRIVATE_KEY)
  console.info(`Creation of issuer cell tx has been sent with tx hash ${txHash}`)
  return txHash
}

export const destroyIssuerCell = async issuerOutPoint => {
  const inputs = [
    {
      previousOutput: issuerOutPoint,
      since: '0x0',
    },
  ]
  const issuerCell = await getLiveCell(issuerOutPoint)
  const output = issuerCell.output
  output.capacity = `0x${(BigInt(output.capacity) - FEE).toString(16)}`
  output.type = null
  const outputs = [output]
  const outputsData = ['0x']

  const cellDeps = [await secp256k1Dep(), IssuerTypeDep]

  const rawTx = {
    version: '0x0',
    cellDeps,
    headerDeps: [],
    inputs,
    outputs,
    outputsData,
    witnesses: [],
  }
  rawTx.witnesses = rawTx.inputs.map((_, i) => (i > 0 ? '0x' : { lock: '', inputType: '', outputType: '' }))
  const signedTx = ckb.signTransaction(PRIVATE_KEY)(rawTx)
  console.log(JSON.stringify(signedTx))
  const txHash = await ckb.rpc.sendTransaction(signedTx, 'passthrough')
  console.info(`Destroy issuer cell tx has been sent with tx hash ${txHash}`)
  return txHash
}

export const updateIssuerCell = async (issuerOutPoint, isAlwaysSuccessLock = false) => {
  const inputs = [
    {
      previousOutput: issuerOutPoint,
      since: '0x0',
    },
  ]

  const issuerCell = await getLiveCell(issuerOutPoint)
  const outputs = [issuerCell.output]
  outputs[0].capacity = `0x${(BigInt(outputs[0].capacity) - FEE).toString(16)}`

  const issuer = Issuer.fromString(issuerCell.data.content)
  issuer.updateInfo('0x1234')
  const outputsData = [issuer.toString()]

  const cellDeps = [isAlwaysSuccessLock ? alwaysSuccessCellDep() : await secp256k1Dep(), IssuerTypeDep]

  const rawTx = {
    version: '0x0',
    cellDeps,
    headerDeps: [],
    inputs,
    outputs,
    outputsData,
    witnesses: [],
  }
  let txHash = ''
  if (isAlwaysSuccessLock) {
    rawTx.witnesses = rawTx.inputs.map(() => '0x')
    txHash = await ckb.rpc.sendTransaction(rawTx)
  } else {
    rawTx.witnesses = rawTx.inputs.map((_, i) => (i > 0 ? '0x' : { lock: '', inputType: '', outputType: '' }))
    const signedTx = ckb.signTransaction(PRIVATE_KEY)(rawTx)
    txHash = await ckb.rpc.sendTransaction(signedTx, 'passthrough')
  }
  console.info(`Update issuer cell tx has been sent with tx hash ${txHash}`)
  return txHash
}
