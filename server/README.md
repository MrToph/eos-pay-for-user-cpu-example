# server

Relevant part:

```typescript
// server/src/routes/sign.ts

import { Request, Response, Router, Express } from 'express';
import { BAD_REQUEST, CREATED, OK } from 'http-status-codes';
import { api } from 'src/eos/api';
import { PushTransactionArgs } from 'eosjs/dist/eosjs-rpc-interfaces';
import { getNetwork } from 'src/eos/networks';

const router = Router();

const buffer2hex = (buffer: Uint8Array) => Array.from(buffer, (x: number) =>
    ("00" + x.toString(16)).slice(-2)
).join("");

// we allow actions on this contract
const ALLOWED_CONTRACT = `dappcontract`
const checkAction = (action: any): void => {
    switch (action.account) {
        case `eosio.token`: {
            if (action.data.to !== ALLOWED_CONTRACT) {
                throw new Error(`Free CPU for transfers to other contracts is not granted.`)
            }
            return;
        }
        case ALLOWED_CONTRACT: {
            // any internal action except payforcpu is fine
            // we don't want someone to DDOS by sending only payforcpu actions
            if (action.name === `payforcpu`) {
                throw new Error(`Don't include duplicate payforcpu actions.`)
            }
            return;
        }
        default: {
            throw new Error(`Free CPU for actions on ${action.account} is not granted.`)
        }
    }
}

const checkTransaction = (tx: any): void => {
    tx.actions.forEach(checkAction)
}

router.post('/sign', async (req: Request, res: Response) => {
    try {
        const { tx, txHeaders = {} } = req.body;
        if (!tx || !tx.actions) {
            return res.status(BAD_REQUEST).json({
                error: `No transaction passed`,
            });
        }

        checkTransaction(tx)

        // insert cpu payer's payforcpu action as first action to trigger ONLY_BILL_FIRST_AUTHORIZER
        tx.actions.unshift({
            account: ALLOWED_CONTRACT,
            name: "payforcpu",
            authorization: [{
                actor: ALLOWED_CONTRACT,
                permission: `payforcpu`
            }],
            data: {}
        });

        // https://github.com/EOSIO/eosjs/blob/master/src/eosjs-api.ts#L214-L254
        // get the serialized transaction
        let pushTransactionArgs: PushTransactionArgs = await api.transact(
            tx,
            {
                blocksBehind: txHeaders.blocksBehind,
                expireSeconds: txHeaders.expireSeconds,
                // don't sign yet, as we don't have all keys and signing would fail
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
```