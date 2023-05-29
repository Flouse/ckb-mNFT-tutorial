export { getCells, getLiveCell } from './lumos-indexer'
import { IndexerCell } from "@ckb-lumos/ckb-indexer/lib/type";

import { Input } from '@ckb-lumos/lumos'
import { FEE } from '../constants/script'

// TODO: deprecate
export const collectInputs = (liveCells: IndexerCell[], needCapacity: bigint) => {
  const inputs: Input[] = []

  let sum = BigInt(0)
  for (const cell of liveCells) {
    inputs.push({
      previousOutput: {
        txHash: cell.outPoint.txHash,
        index: cell.outPoint.index,
      },
      since: '0x0',
    })
    sum = sum + BigInt(cell.output.capacity)
    if (sum >= needCapacity + FEE) {
      break
    }
  }

  console.log(JSON.stringify(liveCells))
  if (sum < needCapacity + FEE) {
    throw Error('Capacity not enough')
  }

  return { inputs, capacity: sum }
}
