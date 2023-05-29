import { serializeInput, blake2b, hexToBytes } from '@nervosnetwork/ckb-sdk-utils'

import { Cell, HexString, Input } from '@ckb-lumos/lumos'
import { minimalScriptCapacity, TransactionSkeleton, minimalCellCapacityCompatible } from '@ckb-lumos/helpers'
import { common as commonScriptHelper } from '@ckb-lumos/common-scripts'

import { generateAccountFromPrivateKey } from '../account'
import { getCells } from '../collector'
import { IssuerTypeScript, IssuerTypeDep, Secp256k1Dep } from '../constants/script'
import { u64ToLe } from '../utils/hex'
import Issuer from '../models/issuer'
import { ckbIndexer } from '../collector/lumos-indexer'
import { random } from '../utils/util'
import { addWitness, signAndSendTx, sumOfCapacity } from '../utils/wallet'
import { Account, CapacityUnit } from '../types'

// FIXME: calc ISSUER_CELL_CAPACITY
const ISSUER_CELL_CAPACITY = BigInt(400) * BigInt(100000000)

// TODO: explain personal(b"ckb-default-hash")
const PERSONAL = new Uint8Array([99, 107, 98, 45, 100, 101, 102, 97, 117, 108, 116, 45, 104, 97, 115, 104])

/**
 * see https://github.com/nervina-labs/ckb-nft-scripts/blob/v0.4.0/contracts/issuer-type/src/entry.rs#L32-L40
 * 
 * TODO: move to utils
 */
const generateIssuerTypeArgs = (firstInput: Input, firstOutputIndex: bigint) => {
  const input = hexToBytes(serializeInput(firstInput))
  const s = blake2b(32, null, null, PERSONAL)
  s.update(input)
  s.update(hexToBytes(`0x${u64ToLe(firstOutputIndex)}`))
  return `0x${s.digest('hex').slice(0, 40)}`
}

/**
 * TODO: createIssuerCell in GitHub Action
 * 
 * @param privKey private key
 * @param issuerInfo the NFT issuer info
 */
export const createIssuerCell = async (
  privKey: HexString,
  issuer: Issuer
) => {
  const issuerAccount: Account = generateAccountFromPrivateKey(privKey)
  const issuerData: HexString = issuer.toHexString()

  // FAQ: How do you set the value of capacity in a Cell?
  // See: https://docs.nervos.org/docs/essays/faq/#how-do-you-set-the-value-of-capacity-in-a-cell
  const minimalCellCapacity = minimalScriptCapacity(issuerAccount.lockScript) + 800000000n
  const issuerCellCapacity = BigInt(8 + 53 + 53 + (issuerData.length - 2) / 2) * BigInt(CapacityUnit.Byte)
  const requiredCapacity = issuerCellCapacity + minimalCellCapacity

  const inputCells = await getCells(
    issuerAccount.lockScript,
    undefined, /* search input cells with no type script */
    requiredCapacity)
  const collectedCapacity = inputCells.reduce(sumOfCapacity, 0n)
  if (collectedCapacity < requiredCapacity) throw new Error('Not enough CKB to create issuer cell')

  // get firstInput after injectCapacity
  const firstInput: Input = { previousOutput: inputCells[0].outPoint, since: '0x0' }
  const issuerTypeArgs = generateIssuerTypeArgs(firstInput, BigInt(0))
  
  const targetOutput: Cell = {
    cellOutput: {
      capacity: '0x' + issuerCellCapacity.toString(16),
      lock: issuerAccount.lockScript,
      type: { ...IssuerTypeScript, args: issuerTypeArgs },
    },
    data: issuer.toHexString()
  }
  if (minimalCellCapacityCompatible(targetOutput).gt(issuerCellCapacity)) {
    throw new Error('Invalid capacity of target cell')
  }
  const changeCell: Cell = {
    cellOutput: {
      capacity: "0x" + (collectedCapacity - issuerCellCapacity).toString(16),
      lock: issuerAccount.lockScript,
    },
    data: "0x"
  }

  // construct the create_issuer_transaction through TransactionSkeleton
  // see also https://lumos-website.vercel.app/#5-create-a-transfer-transaction
  let txSkeleton = TransactionSkeleton({ cellProvider: ckbIndexer })
  txSkeleton = txSkeleton.update('inputs', inputs => inputs.push(...inputCells))
  txSkeleton = txSkeleton.update('cellDeps', deps => deps.push(...[Secp256k1Dep, IssuerTypeDep]))
  txSkeleton = txSkeleton.update('outputs', outputs => outputs.push(...[targetOutput, changeCell]))
  txSkeleton = txSkeleton.update('fixedEntries', fes => fes.push({ field: 'outputs', index: 0 }))

  // add witness placeholder for the skeleton, it helps in transaction fee estimation
  txSkeleton = addWitness(txSkeleton)

  // pay fee
  txSkeleton = await commonScriptHelper.payFeeByFeeRate(
    txSkeleton,
    [issuerAccount.address],
    random(1000, 2000))

  const txHash = await signAndSendTx(txSkeleton, privKey)
  return txHash
}

/*
const ckb = new CKB(CKB_NODE_RPC)
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

  const issuer = Issuer.fromHexString(issuerCell.data.content)
  issuer.updateInfo('0x1234')
  const outputsData = [issuer.toHexString()]

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
*/