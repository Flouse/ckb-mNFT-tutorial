import CKB from '@nervosnetwork/ckb-sdk-core'
import {
  secp256k1LockScript,
  secp256k1Dep,
  receiverLockScript,
  alwaysSuccessLock,
  alwaysSuccessCellDep,
} from '../account'
import { getCells, collectInputs, getLiveCell } from '../collector'
import { FEE, NFTTypeScript, ClassTypeScript, ClassTypeDep, NFTTypeDep, IssuerTypeDep } from '../constants/script'
import { CKB_NODE_RPC, PRIVATE_KEY } from '../utils/config'
import { u32ToBe } from '../utils/hex'
import TokenClass from '../models/class'
import Nft from '../models/nft'
import { UpdateActions } from '../utils/util'

const ckb = new CKB(CKB_NODE_RPC)
const NFT_CELL_CAPACITY = BigInt(150) * BigInt(100000000)
const NORMAL_CELL_CAPACITY = BigInt(65) * BigInt(100000000)

const generateNftOutputs = async (inputCapacity: bigint, classTypeScripts: CKBComponents.Script[]) => {
  const lock = await secp256k1LockScript()
  const outputs: CKBComponents.CellOutput[] = classTypeScripts.map(classTypeScript => ({
    capacity: `0x${NFT_CELL_CAPACITY.toString(16)}`,
    lock,
    type: classTypeScript,
  }))
  const changeCapacity = inputCapacity - FEE - NFT_CELL_CAPACITY * BigInt(classTypeScripts.length)
  outputs.push({
    capacity: `0x${changeCapacity.toString(16)}`,
    lock,
  })
  return outputs
}

export const createNftCells = async (classTypeArgs: Hex, nftCount = 1) => {
  const lock = await secp256k1LockScript()
  const liveCells = await getCells(lock)
  const { inputs, capacity } = collectInputs(liveCells, NFT_CELL_CAPACITY * BigInt(nftCount))

  const classType = { ...ClassTypeScript, args: classTypeArgs }
  const classCells = await getCells(lock, classType)
  const classOutPoint = { txHash: classCells[0].outPoint.txHash, index: classCells[0].outPoint.index }
  const classInput = {
    previousOutput: classOutPoint,
    since: '0x0',
  }

  const classCell = await getLiveCell(classOutPoint)
  const tokenClass = TokenClass.fromString(classCell.data.content)
  if (tokenClass.total - tokenClass.issued < nftCount) {
    throw new Error('The class cell issued count overflow')
  }
  const classOutput = classCell.output
  const nftTypeScripts = []
  const nfts = []
  const nft = Nft.fromProps({
    version: 0,
    characteristic: [1, 0, 0, 0, 0, 0, 0, 0],
    configure: '0x00',
    state: '0x00',
    extinfoData: '',
  }).toString()
  for (let i = 0; i < nftCount; i++) {
    nftTypeScripts.push({
      ...NFTTypeScript,
      args: `${classTypeArgs}${u32ToBe(tokenClass.issued + i)}`,
    })
    nfts.push(nft)
  }

  const outputClass = TokenClass.fromString(classCell.data.content)
  outputClass.updateIssued(tokenClass.issued + nftCount)

  const outputs = await generateNftOutputs(capacity, nftTypeScripts)
  const cellDeps = [await secp256k1Dep(), ClassTypeDep, NFTTypeDep]

  const rawTx = {
    version: '0x0',
    cellDeps,
    headerDeps: [],
    inputs: [classInput, ...inputs],
    outputs: [classOutput, ...outputs],
    outputsData: [outputClass.toString(), ...nfts, '0x'],
    witnesses: [],
  }
  rawTx.witnesses = rawTx.inputs.map((_, i) => (i > 0 ? '0x' : { lock: '', inputType: '', outputType: '' }))
  const signedTx = ckb.signTransaction(PRIVATE_KEY)(rawTx)
  console.log(JSON.stringify(signedTx))
  const txHash = await ckb.rpc.sendTransaction(signedTx, 'passthrough')
  console.info(`Creating nft cells tx has been sent with tx hash ${txHash}`)
  return txHash
}

export const transferNftCells = async (nftOutPoints: CKBComponents.OutPoint[]) => {
  const inputs = nftOutPoints.map(outPoint => ({
    previousOutput: outPoint,
    since: '0x0',
  }))

  const outputs = []
  const outputsData = []
  const receiverLock = receiverLockScript()
  for await (const outPoint of nftOutPoints) {
    const nftCell = await getLiveCell(outPoint)
    outputs.push({ ...nftCell.output, lock: receiverLock })
    outputsData.push(nftCell.data.content)
  }
  outputs[0].capacity = `0x${(BigInt(outputs[0].capacity) - FEE).toString(16)}`

  const cellDeps = [await secp256k1Dep(), NFTTypeDep]

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
  console.info(`Transfer nft cells tx has been sent with tx hash ${txHash}`)
  return txHash
}

export const destroyNftCells = async (nftOutPoints: CKBComponents.OutPoint[]) => {
  const inputs = nftOutPoints.map(outPoint => ({
    previousOutput: outPoint,
    since: '0x0',
  }))
  const outputs = []
  nftOutPoints.forEach(async nftOutPoint => {
    const nftCell = await getLiveCell(nftOutPoint)
    const output: CKBComponents.CellOutput = nftCell.output
    output.capacity = `0x${(BigInt(output.capacity) - FEE).toString(16)}`
    output.type = null
    outputs.push(output)
  })

  const outputsData = nftOutPoints.map(_ => '0x')

  const cellDeps = [await secp256k1Dep(), NFTTypeDep]

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
  console.info(JSON.stringify(signedTx))
  const txHash = await ckb.rpc.sendTransaction(signedTx, 'passthrough')
  console.info(`Destroy nft cell tx has been sent with tx hash ${txHash}`)
  return txHash
}

export const destroyNftCellsWithIssuerLock = async ({ issuerOutPoint, nftOutPoints }: NftIssuerProps) => {
  const lock = await secp256k1LockScript()
  const liveCells = await getCells(lock)
  const { inputs: normalCells } = collectInputs(liveCells, NORMAL_CELL_CAPACITY)

  const inputs = [normalCells[0]]
  nftOutPoints.forEach(nftOutPoint => {
    inputs.push({
      previousOutput: nftOutPoint,
      since: '0x0',
    })
  })

  const issuerCellDep: CKBComponents.CellDep = { outPoint: issuerOutPoint, depType: 'code' }

  const outputs = []
  const issuerNormalCell = await getLiveCell(normalCells[0].previousOutput)
  outputs.push(issuerNormalCell.output)
  outputs[0].capacity = `0x${(BigInt(outputs[0].capacity) - FEE).toString(16)}`

  const outputsData = ['0x']

  nftOutPoints.forEach(async nftOutPoint => {
    const nftCell = await getLiveCell(nftOutPoint)
    const output = nftCell.output
    output.type = null
    outputs.push(output)
    outputsData.push('0x')
  })

  const cellDeps = [issuerCellDep, await secp256k1Dep(), NFTTypeDep, IssuerTypeDep]

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
  console.info(`Destroy nft cell with issuer lock has been sent with tx hash ${txHash}`)
  return txHash
}

export const destroyNftCellsWithClassLock = async ({ classOutPoint, nftOutPoints }: NftClassProps) => {
  const lock = await secp256k1LockScript()
  const liveCells = await getCells(lock)
  const { inputs: normalCells } = collectInputs(liveCells, NORMAL_CELL_CAPACITY)

  const inputs = [normalCells[0]]
  nftOutPoints.forEach(nftOutPoint => {
    inputs.push({
      previousOutput: nftOutPoint,
      since: '0x0',
    })
  })

  const classCellDep: CKBComponents.CellDep = { outPoint: classOutPoint, depType: 'code' }

  const outputs = []
  const classCell = await getLiveCell(normalCells[0].previousOutput)
  outputs.push(classCell.output)
  outputs[0].capacity = `0x${(BigInt(outputs[0].capacity) - FEE).toString(16)}`

  const outputsData = ['0x']

  nftOutPoints.forEach(async nftOutPoint => {
    const nftCell = await getLiveCell(nftOutPoint)
    const output = nftCell.output
    output.type = null
    outputs.push(output)
    outputsData.push('0x')
  })

  const cellDeps = [classCellDep, await secp256k1Dep(), NFTTypeDep, ClassTypeDep]

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
  console.info(`Destroy nft cell with class lock has been sent with tx hash ${txHash}`)
  return txHash
}

const updateNftCells = async (
  nftOutPoints: CKBComponents.OutPoint[],
  action: UpdateActions,
  props?: UpdateNFTProps,
) => {
  const inputs = []
  const outputs = []
  const outputsData = []
  if (action === UpdateActions.UPDATE_STATE_WITH_ISSUER || action === UpdateActions.UPDATE_STATE_WITH_CLASS) {
    const lock = await secp256k1LockScript()
    const liveCells = await getCells(lock)
    const { inputs: normalCells } = collectInputs(liveCells, NORMAL_CELL_CAPACITY)

    inputs.push(normalCells[0])

    const issuerOrClassCell = await getLiveCell(normalCells[0].previousOutput)
    outputs.push(issuerOrClassCell.output)
    outputsData.push('0x')
  }

  nftOutPoints.forEach(async nftOutPoint => {
    inputs.push({
      previousOutput: nftOutPoint,
      since: '0x0',
    })
    const nftCell = await getLiveCell(nftOutPoint)
    outputs.push(nftCell.output)
    outputs[0].capacity = `0x${(BigInt(outputs[0].capacity) - FEE).toString(16)}`

    const nft = Nft.fromString(nftCell.data.content)
    switch (action) {
      case UpdateActions.LOCK:
        nft.lock()
        break
      case UpdateActions.CLAIM:
        nft.claim()
        break
      case UpdateActions.ADD_EXT_INFO:
        nft.addExtInfo(props?.extInfo)
        break
      case UpdateActions.UPDATE_CHARACTERISTIC:
        nft.updateCharacteristic(props?.characteristic)
        break
      case UpdateActions.UPDATE_STATE_WITH_ISSUER:
      case UpdateActions.UPDATE_STATE_WITH_CLASS:
        nft.updateState(props?.state)
        break
      default:
        break
    }
    outputsData.push(nft.toString())
  })

  let cellDeps = []
  if (action == UpdateActions.UPDATE_STATE_WITH_ISSUER) {
    cellDeps.push({ outPoint: props?.issuerOutPoint, depType: 'code' })
  } else if (action == UpdateActions.UPDATE_STATE_WITH_CLASS) {
    cellDeps.push({ outPoint: props?.classOutPoint, depType: 'code' })
  }
  cellDeps = cellDeps.concat([await secp256k1Dep(), NFTTypeDep])

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
  console.info(JSON.stringify(signedTx))
  const txHash = await ckb.rpc.sendTransaction(signedTx, 'passthrough')
  console.info(`${action.toString()} nft cell tx has been sent with tx hash ${txHash}`)
  return txHash
}

export const lockNftCells = async nftOutPoints => await updateNftCells(nftOutPoints, UpdateActions.LOCK)

export const claimNftCells = async nftOutPoints => await updateNftCells(nftOutPoints, UpdateActions.CLAIM, null)

export const addExtInfoToNftCells = async nftOutPoints => {
  const extInfo = '0x5678'
  return await updateNftCells(nftOutPoints, UpdateActions.ADD_EXT_INFO, { extInfo })
}

export const updateNftCharacteristic = async nftOutPoints => {
  const characteristic = [1, 2, 3, 4, 5, 6, 7, 8]
  return await updateNftCells(nftOutPoints, UpdateActions.UPDATE_CHARACTERISTIC, { characteristic })
}

export const updateNftStateWithIssuer = async ({ nftOutPoints, issuerOutPoint }: NftIssuerProps) => {
  const state = '0x00'
  return await updateNftCells(nftOutPoints, UpdateActions.UPDATE_STATE_WITH_ISSUER, { state, issuerOutPoint })
}

export const updateNftStateWithClass = async ({ nftOutPoints, classOutPoint }: NftClassProps) => {
  const state = '0x00'
  return await updateNftCells(nftOutPoints, UpdateActions.UPDATE_STATE_WITH_CLASS, { state, classOutPoint })
}
