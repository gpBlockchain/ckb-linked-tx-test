import {
    buildTransactionWithInput, findAllCellsWithCheckCap,
    signTransactionWithPrivate
} from "../src/linkedTxServer";
import {init, RPCClient} from "../src/config";
import {BI} from "@ckb-lumos/lumos";
import fs from "fs";
import {Config} from "./demo";
import {getSecp256k1Account} from "../src/util";


async function main() {
    const configFile: string = fs.readFileSync('./config.json').toString();
    const config: Config = JSON.parse(configFile) as Config;
    await init(config.ckbUrl)
    let cells = await findAllCellsWithCheckCap({
        lock: getSecp256k1Account(config.account).lockScript,
        type: "empty"
    }, BI.from(100 * config.cellCount * 10 ** 8))

    let tx = await buildTransactionWithInput(cells, config.cellCount, BI.from(1000))
    let rawTx = signTransactionWithPrivate(tx, config.account)
    let txHash = await RPCClient.sendTransaction(rawTx)
    console.log(txHash)
}

main()