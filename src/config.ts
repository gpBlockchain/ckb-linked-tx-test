import {config, RPC, utils} from "@ckb-lumos/lumos";
import {CkbIndexer} from "@ckb-lumos/ckb-indexer/lib/indexer";
import {createConfig, initializeConfig, predefined, ScriptConfigs} from "@ckb-lumos/config-manager";


export let CKB_RPC_URL = "https://testnet.ckb.dev"
export let RPCClient = new RPC(CKB_RPC_URL);
export let CKBIndexerClient = new CkbIndexer(CKB_RPC_URL);
config.initializeConfig(config.predefined.AGGRON4)


export async function init(url: string) {
    CKB_RPC_URL = url;
    console.log(`url:${CKB_RPC_URL}`)
    RPCClient = new RPC(CKB_RPC_URL);
    CKBIndexerClient = new CkbIndexer(CKB_RPC_URL);
    const _genesisConfig = await getGenesisScriptConfig(RPCClient);

    let prefix = "ckt"
    let consensus = await RPCClient.getConsensus()
    if (consensus.id == "ckb") {
        prefix = "ckb"
    }
    const CONFIG = createConfig({
        PREFIX: prefix,
        SCRIPTS: {
            ...predefined.AGGRON4.SCRIPTS,
            ..._genesisConfig,
        },
    });
    initializeConfig(CONFIG);

}

async function getGenesisScriptConfig(rpc: RPC): Promise<ScriptConfigs> {
    const genesisBlock = await rpc.getBlockByNumber("0x0");

    const secp256k1DepTxHash = genesisBlock.transactions[1].hash;
    const secp256k1TypeScript = genesisBlock.transactions[0].outputs[1].type;
    const secp256k1TypeHash = utils.computeScriptHash(secp256k1TypeScript!);

    const daoDepTxHash = genesisBlock.transactions[0].hash;
    const daoTypeScript = genesisBlock.transactions[0].outputs[2].type;
    const daoTypeHash = utils.computeScriptHash(daoTypeScript!);

    return {
        SECP256K1_BLAKE160: {
            HASH_TYPE: "type",
            CODE_HASH: secp256k1TypeHash,
            TX_HASH: secp256k1DepTxHash!,
            INDEX: "0x0",
            DEP_TYPE: "depGroup",
        },
        SECP256K1_BLAKE160_MULTISIG: {
            CODE_HASH: '0x5c5069eb0857efc65e1bca0c07df34c31663b3622fd3876c876320fc9634e2a8',
            HASH_TYPE: 'type',
            TX_HASH: secp256k1DepTxHash!,
            INDEX: '0x1',
            DEP_TYPE: 'depGroup',
            SHORT_ID: 1
        },
        DAO: {
            HASH_TYPE: "type",
            CODE_HASH: daoTypeHash,
            TX_HASH: daoDepTxHash!,
            INDEX: "0x2",
            DEP_TYPE: "code",
        },
    };
}
