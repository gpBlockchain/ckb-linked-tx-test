import {BI, Cell, CellDep, config, helpers, WitnessArgs} from "@ckb-lumos/lumos";
import {TransactionWithStatus} from "@ckb-lumos/base/lib/api";
import {blockchain} from "@ckb-lumos/base";
import {encodeToAddress, sealTransaction, TransactionSkeletonType} from "@ckb-lumos/helpers";
import {common} from "@ckb-lumos/common-scripts";
import {key} from "@ckb-lumos/hd";
import {CKB_RPC_URL, CKBIndexerClient, RPCClient} from "./config";
import {asyncSleep, getSecp256k1Account} from "./util";
import {CKBIndexerQueryOptions, OtherQueryOptions} from "@ckb-lumos/ckb-indexer/lib/type";
import {bytes} from "@ckb-lumos/codec";
import {formatter as paramsFmts} from "@ckb-lumos/rpc/lib/paramsFormatter";
import {CKBComponents} from "@ckb-lumos/rpc/lib/types/api";


export async function getCells(accountPrivate: string, count: number, minCapacity: number = 71): Promise<Cell[]> {
    let account = getSecp256k1Account(accountPrivate)
    console.log("account address:", account.address)
    return await findCells({
        lock: account.lockScript,
        type: "empty",
        outputCapacityRange: [BI.from(minCapacity * 10 ** 8).toHexString(), BI.from(9999999999 * 10 ** 8).toHexString()]
    }, count)
}


export async function findAllCellsWithCheckCap(
    queries: CKBIndexerQueryOptions,
    minCap: BI,
    otherQueryOptions?: OtherQueryOptions
): Promise<Cell[]> {
    const cellCollector = CKBIndexerClient.collector(queries, otherQueryOptions);
    const cells: Cell[] = [];
    let cap = BI.from(0);
    for await (const cell of cellCollector.collect()) {
        cells.push(cell);
        cap = cap.add(cell.cellOutput.capacity)
        if (cap.gt(minCap)) {
            return cells;
        }
    }

    // @ts-ignore
    let address = encodeToAddress(queries.lock);
    throw new Error(`not have enough money,expected:${minCap.toNumber()},only:${cap.toNumber()},address:${address}`)
}

async function findCells(
    queries: CKBIndexerQueryOptions,
    count: number,
    otherQueryOptions?: OtherQueryOptions
): Promise<Cell[]> {
    const cellCollector = CKBIndexerClient.collector(queries, otherQueryOptions);
    const cells: Cell[] = [];
    let number = 0;
    for await (const cell of cellCollector.collect()) {
        cells.push(cell);
        number += 1;
        if (number == count) {
            return cells;
        }
    }

    // @ts-ignore
    let address = encodeToAddress(queries.lock);
    throw new Error(`cells count:${number} not enough,expected:${count},address:${address}`)
}


export async function buildAndSendTransactionWithCells(cells: Cell[], select_list: number[], account_private: string, fee: number) {
    // get select cells
    const select_cells = select_list.map(index => cells[index]);
    // build cells
    let tx = buildTransactionWithInput(select_cells, select_cells.length, BI.from(fee))
    let rawTx = signTransactionWithPrivate(tx, account_private)
    // send cells
    let timestamp = Date.now();
    //todo 如果报错了, 直接移除 相关cell
    // let txHash = await RPCClient.sendTransaction(rawTx)
    // let txHash = await send_test_transaction(CKB_RPC_URL,rawTx)
    let txHash = "";
    for (let i = 0; i < 10; i++) {
        try {
            txHash = await send_test_transaction(CKB_RPC_URL, rawTx)
            break
        } catch (e) {
            await asyncSleep(1000)
            console.log(`try again ${i}:${e}`)
            if (i == 9) {
                throw e
            }
        }
    }
    // console.log("send tx:", txHash)
    // update cells
    select_list.forEach((select, index) => {
        cells[select] = tx.outputs.get(index)!;
    })
    tx.outputs.forEach((cell, index) => {
        cell.outPoint = {txHash: txHash, index: BI.from(index).toHexString()}
        cells[select_list[index]] = cell;
    })
    return {
        cells: cells,
        txHash: txHash,
        timestamp: timestamp
    };
}

export function signTransactionWithPrivate(txSkeleton: TransactionSkeletonType, accountPrivateKey: string) {
    // prepareSigningEntries(rawTx)
    txSkeleton = common.prepareSigningEntries(txSkeleton);
    let sigs = []
    for (let i = 0; i < txSkeleton.get("signingEntries").size; i++) {
        let message = txSkeleton.get("signingEntries").get(i)?.message;
        let Sig = key.signRecoverable(message!, accountPrivateKey);
        sigs.push(Sig)
    }
    let tx = sealTransaction(txSkeleton, sigs);
    return tx;
}

export function buildTransactionWithInput(cells: Cell[], outputCount: number, fee: BI): TransactionSkeletonType {
    // cell dep
    let tx = helpers.TransactionSkeleton()

    let new_cellDeps: CellDep[] = [{
        depType: config.getConfig().SCRIPTS.SECP256K1_BLAKE160!.DEP_TYPE,
        outPoint: {
            txHash: config.getConfig().SCRIPTS.SECP256K1_BLAKE160!.TX_HASH,
            index: config.getConfig().SCRIPTS.SECP256K1_BLAKE160!.INDEX
        },
    }]
    tx = tx.update("cellDeps", (cellDeps) => cellDeps.push(...new_cellDeps));

    // input
    tx = tx.update("inputs", (inputs) => inputs.push(...cells));

    const totalCapacity = cells.reduce((accumulator, cell) => accumulator.add(cell.cellOutput.capacity), BI.from("0"));
    // outputs
    const outputCapacity = totalCapacity.div(outputCount).sub(fee)
    let new_outputs: Cell[] = []
    for (let i = 0; i < outputCount; i++) {
        new_outputs.push({
            cellOutput: {
                capacity: outputCapacity.toHexString(),
                lock: cells[0].cellOutput.lock,
                // type:
            },
            data: "0x"
        })
    }
    tx = tx.update("outputs", (outputs) => outputs.push(...new_outputs));

    // witnesses
    const newWitnessArgs: WitnessArgs = {
        /* 65-byte zeros in hex */
        lock:
            "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    };
    let new_witnesses = cells.map(inputs => "0x")
    new_witnesses[0] = bytes.hexify(blockchain.WitnessArgs.pack(newWitnessArgs))
    tx = tx.update("witnesses", (witnesses) => witnesses.push(...new_witnesses));

    return tx;
}


export async function waitTransactionCommitted(
    txHash: string,
    options: {
        timeout?: number;
    } = {}
): Promise<TransactionWithStatus> {
    const {timeout = 1200 * 1000} = options;

    let tx = await RPCClient.getTransaction(txHash);
    if (!tx) {
        throw new Error(`not found tx: ${txHash}`);
    }

    let duration = 0;
    while (
        tx.txStatus.status === "pending" ||
        tx.txStatus.status === "proposed" || tx.txStatus.status === "unknown"
        ) {
        if (duration > timeout) {
            throw new Error(`wait transaction committed timeout ${txHash}`);
        }
        await asyncSleep(1000);
        duration += 1000;
        tx = await RPCClient.getTransaction(txHash);
    }

    if (tx.txStatus.status !== "committed") {
        throw new Error("transaction status is not committed");
    }

    let rpcTip = Number(await RPCClient.getTipBlockNumber());
    let indexerTip = Number((await CKBIndexerClient.tip()).blockNumber);

    while (rpcTip > indexerTip) {
        await asyncSleep(1000);
        rpcTip = Number(await RPCClient.getTipBlockNumber());
        indexerTip = Number((await CKBIndexerClient.tip()).blockNumber);
    }

    return tx;
}


export async function remove_transaction(CKB_RPC_URL: string, txHash: String): Promise<void> {
    await request(1, CKB_RPC_URL, "remove_transaction", [
        txHash
    ]);
}

export async function clear_tx_pool(CKB_RPC_URL: string): Promise<void> {
    await request(1, CKB_RPC_URL, "clear_tx_pool", [
    ]);
}


export async function send_test_transaction(CKB_RPC_URL: string, tx: CKBComponents.RawTransaction): Promise<string> {
    const res = await request(1, CKB_RPC_URL, "send_test_transaction", [
        paramsFmts.toRawTransaction(tx), "passthrough"
    ]);
    return res;
}

const RPC_DEBUG_SERVICE = false

export const request = async (
    id: number,
    ckbIndexerUrl: string,
    method: string,
    params?: any
): Promise<any> => {
    if (RPC_DEBUG_SERVICE) {
        console.log("curl --location --request POST '" + ckbIndexerUrl + "' \\\n" +
            "--header 'Content-Type: application/json' \\\n" +
            "--data-raw '{\n" +
            "\t\"jsonrpc\":\"2.0\",\n" +
            "\t\"method\":\"" + method + "\",\n" +
            "\t\"params\":" + JSON.stringify(params) + ",\n" +
            "\t\"id\":64\n" +
            "}'")
    }
    const res = await fetch(ckbIndexerUrl, {
        method: "POST",
        body: JSON.stringify({
            id,
            jsonrpc: "2.0",
            method,
            params
        }),
        headers: {
            "Content-Type": "application/json"
        }
    });
    if (res.status !== 200) {
        throw new Error(`light client request failed with HTTP code ${res.status}`);
    }
    const data = await res.json();

    if (data.error !== undefined) {
        if (RPC_DEBUG_SERVICE) {
            console.log(JSON.stringify(data.error))
        }
        throw new Error(
            `light client request rpc failed with error: ${JSON.stringify(
                data.error
            )}`
        );
    }
    if (RPC_DEBUG_SERVICE) {
        console.log(JSON.stringify(data.result))
    }
    return data.result;
};
