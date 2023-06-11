import { RPC as CKBRPC, Cell, Indexer as LumosIndexer, OutPoint, Script } from '@ckb-lumos/lumos'
import { CKB_NODE_RPC_URL } from '../utils/config'

export const ckbIndexer = new LumosIndexer(CKB_NODE_RPC_URL)
export const ckbRPC = new CKBRPC(CKB_NODE_RPC_URL)

/**
 * collect cells
 *
 * @param lock The lock script protects the collected cells
 * @param type The type script protects the collected cells
 * @param requiredCapacity The required capacity sum of the input cells
 */
export async function getCells(lock: Script, type?: Script, requiredCapacity?: bigint): Promise<Cell[]> {
  const collector = ckbIndexer.collector({
    lock,
    type,
    // If type script is undefined, then only collect cells with 0 output data length.
    //
    // outputDataLenRange: filter cells by output data len range, [inclusive, exclusive)
    // data length range: [0, 1), which means the data length is 0
    outputDataLenRange: type ? undefined : ['0x0', '0x1'],
  })

  let _needCapacity: bigint = requiredCapacity ?? 0n
  const collected: Cell[] = []

  for await (const inputCell of collector.collect()) {
    collected.push(inputCell)
    _needCapacity -= BigInt(inputCell.cellOutput.capacity)
    if (_needCapacity <= 0) break
  }

  return collected
}

/**
 * get live cell through Lumos CKBRPC
 *
 * @param {OutPoint} outPoint outPoint - cell's outPoint
 */
export async function getLiveCell(outPoint: OutPoint) {
  const { cell } = await ckbRPC.getLiveCell(outPoint, true)
  return cell
}

/**
 * collect input cells with empty output data
 * @param lock The lock script protects the input cells
 * @param requiredCapacity The required capacity sum of the input cells
 
export async function collectInputCells(lock: Script, requiredCapacity: bigint): Promise<Cell[]> {
  const collector = ckbIndexer.collector({
    lock,
    // filter cells by output data len range, [inclusive, exclusive)
    // data length range: [0, 1), which means the data length is 0
    outputDataLenRange: ['0x0', '0x1'],
  })

  let _needCapacity = requiredCapacity
  let collected: Cell[] = []
  for await (const inputCell of collector.collect()) {
    collected.push(inputCell)
    _needCapacity -= BigInt(inputCell.cellOutput.capacity)
    if (_needCapacity <= 0) break
  }

  return collected
}*/
