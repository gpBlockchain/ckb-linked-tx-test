import {asyncSleep, getRandCountList} from "../src/util";
import {
    buildAndSendTransactionWithCells, clear_tx_pool,
    getCells,
    remove_transaction,
    waitTransactionCommitted
} from "../src/linkedTxServer";
import {CKB_RPC_URL, init, RPCClient} from "../src/config";
import {BI, Cell} from "@ckb-lumos/lumos";

import * as fs from 'fs';


export interface Config {
    // account private key
    account: string;

    // ckb url
    ckbUrl: string;

    // Number of cells participating in the test
    cellCount: number;

    // Total number of times to send transactions
    sendCount: number;

    // Number of cells to send in each transaction
    txCountRange: [number, number];

    // Transaction fee
    fee: number;

    // Interval between each transaction
    intervalTime: number;
}

async function main1() {

    const configFile: string = fs.readFileSync('./config.json').toString();
    const config: Config = JSON.parse(configFile) as Config;

    // let config: Config = {
    //     account: "",
    //     ckbUrl: "https://testnet.ckb.dev",
    //     cellCount: 250,
    //     sendCount: 1000,
    //     txCountRange: [1, 10],
    //     fee: 1000,
    //     intervalTime: 0,
    // }

    await init(config.ckbUrl)
    await clear_tx_pool("http://43.199.108.57:8022")
    await clear_tx_pool("http://43.198.254.225:8021")
    await RPCClient.clearTxPool()
    let cells = await getCells(config.account, config.cellCount)
    const beforeTotalCapacity = cells.reduce((accumulator, cell) => accumulator.add(cell.cellOutput.capacity), BI.from("0"));

    console.log("cells count:", cells.length)
    let test_message = []
    let latestTimestamp = Date.now();
    for (let i = 0; i < config.sendCount; i++) {
        try {
            let currentTxCount = Math.floor(Math.random() * (config.txCountRange[1] - config.txCountRange[0] + 1)) + config.txCountRange[0]
            let list = getRandCountList(cells.length, currentTxCount)
            console.log(`current:${i} send tx that contains cell index:${list}`)
            let ret = await buildAndSendTransactionWithCells(cells, list, config.account, config.fee)
            if (i == 10) {
                await clear_tx_pool("http://43.199.108.57:8022")
                await clear_tx_pool("http://43.198.254.225:8021")
                // await remove_transaction("http://43.199.108.57:8022", ret.txHash)
                // await remove_transaction("http://43.198.254.225:8021", ret.txHash)
            }
            cells = ret.cells
            let time = ret.timestamp - latestTimestamp
            test_message.push({txHash: ret.txHash, list: list, timeStamp: ret.timestamp, interval_time: time})
            latestTimestamp = ret.timestamp
            console.log(`current:${i} send txHash:${ret.txHash}`)
            await asyncSleep(config.intervalTime)
        } catch (e) {
            console.log(e)
        }
    }


    // try {
    //     let selected_list = cells.map((cells, index) => index)
    //     let ret: {
    //         cells: Cell[],
    //         txHash: string,
    //         timestamp: number
    //     } = {cells: [], txHash: "0x", timestamp: 0};
    //     for (let i = 0; i < 10; i++) {
    //         try {
    //             ret = await buildAndSendTransactionWithCells(cells, selected_list, config.account, config.fee)
    //             console.log("send final txHash:", ret.txHash)
    //             break;
    //         } catch (e) {
    //             console.log(e)
    //             let txPoolInfo = await RPCClient.txPoolInfo()
    //             console.log(`wait children tx committed,try:${i},block num:${BI.from(txPoolInfo.tipNumber).toNumber()} tx pool pending:${BI.from(txPoolInfo.pending).toNumber()},proposal:${BI.from(txPoolInfo.proposed).toNumber()},orphan:${txPoolInfo.orphan}`)
    //             if (i == 99) {
    //                 let txPoolInfo = await RPCClient.txPoolInfo()
    //                 console.log(`txPoolInfo:${JSON.stringify(txPoolInfo)}`)
    //                 let verboseTxPool = await RPCClient.getRawTxPool(true)
    //                 console.log(`verboseTxPool:${JSON.stringify(verboseTxPool)}`)
    //                 throw new Error(`${e}`)
    //             }
    //
    //             await asyncSleep(8000)
    //         }
    //     }
    //
    //     RPCClient.getRawTxPool(true).then(toRawTxPool => {
    //         console.log("")
    //         console.log("final txHash ancestorsSize:", BI.from(toRawTxPool.pending[ret.txHash].ancestorsCount).toNumber())
    //     })
    //     await waitTransactionCommitted(ret.txHash);
    //     cells = ret.cells
    //     console.log("commit successful")
    // } catch (e) {
    //     console.log(e)
    //     console.log("wait commit failed")
    // }
    // const afterTotalCapacity = cells.reduce((accumulator, cell) => accumulator.add(cell.cellOutput.capacity), BI.from("0"));
    // console.log(`before capacity:${beforeTotalCapacity.toBigInt()}`)
    // console.log(`after capacity:${afterTotalCapacity.toBigInt()}`)
    // console.log(`cost capacity:${beforeTotalCapacity.sub(afterTotalCapacity).toBigInt()}`)
    // console.table(test_message)
}

async function main(){
    for (let i = 0; i < 1000000; i++) {
        try {
            await main1()
        }catch (e){}
    }

}
main()