import { ALICE } from '../account/test-accounts'
import { createIssuerCell } from '../actions/issuer'
import Issuer from '../models/issuer'

(async () => {
  // The issuer's info
  const issuerInfo = ALICE.ISSUER_INFO
  const issuer = Issuer.fromProps({
    version: 0, classCount: 0, setCount: 0,
    info: JSON.stringify(issuerInfo)
  })
  console.log(issuer)

  const privateKey = process.env.PRIVATE_KEY || ALICE.PRIVATE_KEY
  const transactionHash = await createIssuerCell(privateKey, issuer)
  console.info(`Creation of issuer cell tx has been sent with tx hash ${transactionHash}`)

  // TODO: open the ckb explorer link of this transaction in browser
})()

/* TODO:
  await destroyIssuerCell({
    txHash: '0xd2dcf173e013f40b5ab3e0a1766a166613e2c91d521e95495b878f829b9fe251',
    index: '0x0',
  })
  TODO: should promote a confirmation step

  await updateIssuerCell(
    {
      txHash: '0xb6d429a60e2339a625c87790359307f0229436a602e39f0df730aaa10c80c89a',
      index: '0x0',
    },
    true,
  )
*/
