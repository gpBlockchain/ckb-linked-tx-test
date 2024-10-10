import fs from "fs";
import {Config} from "./demo";
import {init, RPCClient} from "../src/config";
import {asyncSleep} from "../src/util";

const BATCH_SIZE = 100;
const RESEND_INTERVAL = 250;

async function main() {
    const configFile: string = fs.readFileSync('./config.json').toString();
    const config: Config = JSON.parse(configFile) as Config;
    await init(config.ckbUrl)

    const txInfoMap = new Map();
    const tx_pool = await RPCClient.getRawTxPool(true);
    const current_time = Date.now();

    for (const txPoolKey in tx_pool['pending']) {
        // @ts-ignore
        const {ancestorsCount, timestamp} = tx_pool['pending'][txPoolKey];
        const wait_time = (current_time - parseInt(timestamp, 16)) / 1000;
        txInfoMap.set(txPoolKey, {
            ancestorsCount: parseInt(ancestorsCount),
            txInfo: undefined,
            waitTime: wait_time,
        });
    }

    const txPoolKeys = Array.from(txInfoMap.keys());
    const batches = [];
    for (let i = 0; i < txPoolKeys.length; i += BATCH_SIZE) {
        batches.push(txPoolKeys.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
        const response = await RPCClient.createBatchRequest(batch.map(key => ["getTransaction", key])).exec();
        // @ts-ignore
        response.forEach(tx => {
            const hash = tx['transaction']['hash'];
            if (txInfoMap.has(hash)) {
                const before_data = txInfoMap.get(hash);
                before_data.txInfo = tx['transaction'];
                txInfoMap.set(hash, before_data);
            }
        });
    }

    const sortedEntries = Array.from(txInfoMap.entries()).sort((a, b) => a[1].ancestorsCount - b[1].ancestorsCount);
    let sendTxs = sortedEntries.map(([key]) => key);

    while (sendTxs.length > 0) {
        console.log("sendTxs size:", sendTxs.length);
        const removeIdx: number[] = [];

        for (let i = 0; i < sendTxs.length && i < 20; i++) {
            const txHash = sendTxs[i];
            const tx = txInfoMap.get(txHash);
            console.log(`send txHash:${txHash},waitTime:${tx.waitTime},ancestorsCount:${tx.ancestorsCount}`);
            if (tx.ancestorsCount == 0) {
                removeIdx.push(i);
                continue
            }
            try {
                tx.txInfo.hash = undefined;
                await RPCClient.sendTransaction(tx.txInfo);
            } catch (e) {
                // @ts-ignore
                if (!e.message.includes("PoolRejectedDuplicatedTransaction")) {
                    removeIdx.push(i);
                }
            }
            await asyncSleep(RESEND_INTERVAL);
        }
        // update ancestorsCount and time
        let tx_pool = await RPCClient.getRawTxPool(true);
        let current_time = Date.now();
        for (let key of txInfoMap.keys()) {
            if (tx_pool['pending'][key] == undefined) {
                txInfoMap.get(key).ancestorsCount = 0
                txInfoMap.get(key).waitTime = 0
                continue
            }
            // @ts-ignore
            const {ancestorsCount, timestamp} = tx_pool['pending'][key];
            const wait_time = (current_time - parseInt(timestamp, 16)) / 1000;

            txInfoMap.get(key).ancestorsCount = parseInt(ancestorsCount)
            txInfoMap.get(key).waitTime = wait_time
        }

        sendTxs = sendTxs.filter((_, index) => !removeIdx.includes(index));
    }
    console.log("finished")
    return
}

main()