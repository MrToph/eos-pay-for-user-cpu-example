import { Wallet } from "eos-transit";
import WalletStateSubscribe from "WalletStateSubscribe";
import { PushTransactionArgs } from "eosjs/dist/eosjs-rpc-interfaces";

// TODO: Consider moving to WAL in a generic and convenient way

export function vote(wallet: Wallet) {
  const { auth } = wallet;
  if (!auth) {
    return Promise.reject(
      "No auth information has been passed with transaction"
    );
  }

  const { accountName: senderName, permission } = auth;

  // if user has ever voted, refresh their last vote
  // if (this.voting)
  // 	data = {voter: this.state.auth.accountName, proxy:this.state.accountInfo.voter_info.proxy, producers:this.state.accountInfo.voter_info.producers};

  // if user has never voted, allow voting for TITAN proxy
  const data = { voter: senderName, proxy: "eostitanvote", producers: [] };

  return wallet.eosApi.transact(
    {
      actions: [
        {
          account: "eosio",
          name: "voteproducer",
          authorization: [
            {
              actor: senderName,
              permission: "active"
            }
          ],
          data
        }
      ]
    },
    { blocksBehind: 3, expireSeconds: 60 }
  );
}

export function claim(wallet: Wallet) {
  const { auth } = wallet;
  if (!auth) {
    return Promise.reject(
      "No auth information has been passed with transaction"
    );
  }

  const { accountName: senderName, permission } = auth;

  return wallet.eosApi.transact(
    {
      actions: [
        {
          account: "efxstakepool",
          name: "claim",
          authorization: [
            {
              actor: senderName,
              permission: "active"
            }
          ],
          data: {
            owner: senderName
          }
        },
        {
          account: "efxstakepool",
          name: "claim",
          authorization: [
            {
              actor: senderName,
              permission: "active"
            }
          ],
          data: {
            owner: senderName
          }
        }
      ]
    },
    { blocksBehind: 3, expireSeconds: 60 }
  );
}

export function stake(wallet: Wallet) {
  const { auth } = wallet;
  if (!auth) {
    return Promise.reject(
      "No auth information has been passed with transaction"
    );
  }

  const { accountName: senderName, permission } = auth;

  return wallet.eosApi.transact(
    {
      actions: [
        {
          account: "efxstakepool",
          name: "open",
          authorization: [
            {
              actor: senderName,
              permission: "active"
            }
          ],
          data: {
            owner: senderName,
            ram_payer: senderName
          }
        },
        {
          account: "effecttokens",
          name: "open",
          authorization: [
            {
              actor: senderName,
              permission: "active"
            }
          ],
          data: {
            owner: senderName,
            symbol: `4,NFX`,
            ram_payer: senderName
          }
        },

        {
          account: "effecttokens",
          name: "transfer",
          authorization: [
            {
              actor: senderName,
              permission: "active"
            }
          ],
          data: {
            from: senderName,
            to: "efxstakepool",
            quantity: "1.0000 EFX",
            memo: "stake"
          }
        }
      ]
    },
    { blocksBehind: 3, expireSeconds: 60 }
  );
}

export async function transfer(
  wallet: Wallet,
  receiverName: string,
  amount: number,
  memo: string = "",
  txnCount: number = 2
) {
  const { auth } = wallet;
  if (!auth) {
    return Promise.reject(
      "No auth information has been passed with transaction"
    );
  }

  const { accountName: senderName, permission } = auth;

  if (!senderName) {
    return Promise.reject(
      new Error(
        "Sender account name is not available in a provided wallet auth metadata!"
      )
    );
  }

  if (!receiverName) {
    return Promise.reject(new Error("Receiver account name is not provided!"));
  }

  if (!amount) return Promise.reject(new Error("Amount not specified"));

  const txnBuilder = [];

  console.log(`Build ${txnCount} transactions`);

  for (let index = 0; index < txnCount; index++) {
    txnBuilder.push({
      account: "eosio.token",
      name: "transfer",
      authorization: [
        {
          actor: senderName,
          permission
        }
      ],
      data: {
        from: senderName,
        to: receiverName,
        quantity: `${Number(amount).toFixed(4)} EOS`,
        memo: `Test Txn ${index}`
      }
    });
  }

  // CHANGES:
  const CPU_PAYER = `eosiactester`;

  // insert cpu payer's auth in first action to trigger ONLY_BILL_FIRST_AUTHORIZER
  txnBuilder[0].authorization.unshift({
    actor: CPU_PAYER,
    permission: `freecpu`
  });
  const tx = {
    actions: txnBuilder
  };

  // this also gets serialized
  const transactionHeader = {
    blocksBehind: 3,
    expireSeconds: 60
  };

  let pushTransactionArgs: PushTransactionArgs;

  let serverTransactionPushArgs: PushTransactionArgs | undefined;
  try {
    serverTransactionPushArgs = await serverSign(tx, transactionHeader);
  } catch (error) {
    console.error(`Error when requesting server signature`, error.message);
  }

  if (serverTransactionPushArgs) {
    console.log(`in if seversignature`, serverTransactionPushArgs.signatures);
		// just to initialize the ABIs and other structures on api
		// https://github.com/EOSIO/eosjs/blob/master/src/eosjs-api.ts#L214-L254
    await wallet.eosApi.transact(tx, {
      sign: false,
      broadcast: false,
      ...transactionHeader
    });

		const requiredKeys = await wallet.eosApi.signatureProvider.getAvailableKeys();
		// must use server tx here because blocksBehind header might lead to different TAPOS tx header
    const serializedTx = serverTransactionPushArgs.serializedTransaction;
    const signArgs = {
      chainId: wallet.eosApi.chainId,
      requiredKeys,
      serializedTransaction: serializedTx,
      abis: [],
    };
    pushTransactionArgs = await wallet.eosApi.signatureProvider.sign(signArgs);
    // add server signature
    pushTransactionArgs.signatures.unshift(
      serverTransactionPushArgs.signatures[0]
    );
  } else {
    // no server response => remove auth from tx again
    tx.actions[0].authorization.shift();

    pushTransactionArgs = await wallet.eosApi.transact(tx, {
      ...transactionHeader,
      sign: true,
      broadcast: false
    });
  }

  console.log(pushTransactionArgs.signatures);
  return wallet.eosApi.pushSignedTransaction(pushTransactionArgs);
}

async function serverSign(
  transaction: any,
  txHeaders: any
): Promise<PushTransactionArgs> {
  function buf2hex(buffer: Uint8Array) {
    return Array.from(buffer, (x: number) =>
      ("00" + x.toString(16)).slice(-2)
    ).join("");
  }
  const rawResponse = await fetch("http://localhost:3031/api/eos/sign", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ tx: transaction, txHeaders })
  });

	const content = await rawResponse.json();
	const pushTransactionArgs = {
		...content,
		serializedTransaction: Buffer.from(content.serializedTransaction, `hex`)
	}

  return pushTransactionArgs;
}
