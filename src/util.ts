import {Script} from "@ckb-lumos/base/lib/api";
import {key} from "@ckb-lumos/hd";
import {getConfig} from "@ckb-lumos/config-manager";
import {encodeToAddress} from "@ckb-lumos/helpers";


export interface Account {
    lockScript: Script;
    address: string;
    pubKey: string;
    privKey: string;
}


export const getSecp256k1Account = (privKey: string): Account => {
    const pubKey = key.privateToPublic(privKey);
    const args = key.publicKeyToBlake160(pubKey);
    const template = getConfig().SCRIPTS["SECP256K1_BLAKE160"]!;
    const lockScript = {
        codeHash: template.CODE_HASH,
        hashType: template.HASH_TYPE,
        args: args,
    };

    const address = encodeToAddress(lockScript);

    return {
        lockScript,
        address,
        pubKey,
        privKey: privKey,
    };
};

export function getRandCountList(maxNumber: number, randCount: number): number[] {
    if (randCount > maxNumber) {
        throw new Error('Rand count cannot exceed max number');
    }

    if (randCount > 2000) {
        throw new Error('Rand count should be less than or equal to 2000 for storage-based approach');
    }

    // Create an array to store all possible numbers from 0 to maxNumber
    const possibleNumbers: number[] = [];
    for (let i = 0; i < maxNumber; i++) {
        possibleNumbers.push(i);
    }

    const randomNumbers: number[] = [];

    // Shuffle the possibleNumbers array to get a random order
    for (let i = possibleNumbers.length - 1; i > 0; i--) {
        const randomIndex = Math.floor(Math.random() * (i + 1));
        [possibleNumbers[i], possibleNumbers[randomIndex]] = [possibleNumbers[randomIndex], possibleNumbers[i]];
    }

    // Select the desired number of random numbers from the shuffled array
    for (let i = 0; i < randCount; i++) {
        randomNumbers.push(possibleNumbers[i]);
    }

    return randomNumbers;
}


export function asyncSleep(ms: number): Promise<unknown> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
