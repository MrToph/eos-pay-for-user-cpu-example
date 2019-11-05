import { Api } from 'eosjs';
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig';
import { TextDecoder, TextEncoder } from 'util';
import { rpc } from './networks';

let keys = [process.env.EOSIO_SIGNING_KEY].filter(Boolean).map(s => s!.trim()).filter(Boolean)
if(keys.length === 0) {
    console.error(`No private keys passed. You'll be unable to sign`)
}
const signatureProvider = new JsSignatureProvider(keys)

const api = new Api({
    rpc,
    signatureProvider,
    textDecoder: new TextDecoder() as any,
    textEncoder: new TextEncoder(),
})

export {
    api,
}