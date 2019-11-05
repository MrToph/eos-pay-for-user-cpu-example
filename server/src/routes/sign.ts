
import { Request, Response, Router, Express } from 'express';
import { BAD_REQUEST, CREATED, OK } from 'http-status-codes';
import { api } from 'src/eos/api';
import { PushTransactionArgs } from 'eosjs/dist/eosjs-rpc-interfaces';
import { getNetwork } from 'src/eos/networks';
import { Serialize } from 'eosjs';

// Init shared
const router = Router();

const buffer2hex = (buffer: Uint8Array) => Array.from(buffer, (x: number) =>
    ("00" + x.toString(16)).slice(-2)
).join("");

const ALLOWED_ACCOUNT = `cmichelkylin`
const checkAction = (action: any): void => {
    switch (action.account) {
        case `eosio.token`: {
            if (action.data.to !== ALLOWED_ACCOUNT) {
                throw new Error(`CPU for transfers to other accounts are not paid.`)
            }
        }
        case ALLOWED_ACCOUNT: {
            // any internal action is fine
            return;
        }
        default: {
            throw new Error(`CPU for actions on ${action.account} are not paid.`)
        }
    }
}
const checkTransaction = (tx: any): void => {
    tx.actions.forEach(checkAction)
}

router.post('/sign', async (req: Request, res: Response) => {
    try {
        const { tx, txHeaders = {} } = req.body;
        if (!tx) {
            return res.status(BAD_REQUEST).json({
                error: `No transaction passed`,
            });
        }

        checkTransaction(tx)

        // https://github.com/EOSIO/eosjs/blob/master/src/eosjs-api.ts#L214-L254
        let pushTransactionArgs: PushTransactionArgs = await api.transact(
            tx,
            {
                blocksBehind: txHeaders.blocksBehind,
                expireSeconds: txHeaders.expireSeconds,
                // don't sign yet, as we don't have all keys and it signing would fail
                sign: false,
                // don't broadcast yet, merge signatures first
                broadcast: false,
            }
        )

        // JSSignatureProvider throws errors when encountering a key that it doesn't have a private key for
        // so we cannot use it for partial signing unless we change requiredKeys
        // https://github.com/EOSIO/eosjs/blob/849c03992e6ce3cb4b6a11bf18ab17b62136e5c9/src/eosjs-jssig.ts#L38
        const availableKeys = await api.signatureProvider.getAvailableKeys()
        const serializedTx = pushTransactionArgs.serializedTransaction
        const signArgs = { chainId: getNetwork().chainId, requiredKeys: availableKeys, serializedTransaction: serializedTx, abis: [] }
        pushTransactionArgs = await api.signatureProvider.sign(signArgs)

        console.log(buffer2hex(pushTransactionArgs.serializedTransaction))
        console.log(pushTransactionArgs.signatures)
        const returnValue = {
            ...pushTransactionArgs,
            serializedTransaction: buffer2hex(pushTransactionArgs.serializedTransaction)
        }
        return res.status(CREATED).json(returnValue);
    } catch (err) {
        console.error(err.message)
        return res.status(BAD_REQUEST).json({
            error: err.message,
        });
    }
});

export default router;
