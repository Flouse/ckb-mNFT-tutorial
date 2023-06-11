import { config } from '@ckb-lumos/lumos'
import dotenv from 'dotenv'

dotenv.config()
config.initializeConfig(config.predefined.AGGRON4)

export const PRIVATE_KEY = process.env.PRIVATE_KEY
export const RECEIVER_ADDRESS = process.env.RECEIVER_ADDRESS

// Uses CKB testnet by default
// CKB Testnet Explorer: https://pudge.explorer.nervos.org
export const CKB_NODE_RPC_URL = process.env.CKB_NODE_RPC || 'https://testnet.ckb.dev/rpc'

export const TESTNET_SCRIPTS = config.predefined.AGGRON4.SCRIPTS

// TODO: export secp256k1LockScript
// replace secp256k1LockScript in src/account/index.ts
