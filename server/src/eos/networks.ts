import { JsonRpc } from 'eosjs';
import fetch from 'node-fetch'

export type TEOSNetwork = {
  chainId: string;
  nodeEndpoint: string;
  protocol: string;
  host: string;
  port: number;
};

const createNetwork = (nodeEndpoint: string, chainId: string): TEOSNetwork => {
  const matches = /^(https?):\/\/(.+):(\d+)\D*$/.exec(nodeEndpoint);
  if (!matches) {
    throw new Error(
      `Could not parse EOS HTTP endpoint. Needs protocol and port: "${nodeEndpoint}"`,
    );
  }

  const [, httpProtocol, host, port] = matches;

  return {
    chainId,
    protocol: httpProtocol,
    host,
    port: Number.parseInt(port, 10),
    nodeEndpoint,
  };
};

const KylinNetwork: TEOSNetwork = createNetwork(
  `https://kylin-dsp-2.liquidapps.io:443`,
  `5fff1dae8dc8e2fc4d5b23b2c7665c97f9e9d8edf2b6485a86ba311c25639191`,
);

const MainNetwork: TEOSNetwork = createNetwork(
  `https://mainnet.eoscanada.com:443`,
  `aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906`,
);

function getNetworkName() {
  return `kylin`
}

function getNetwork() {
  const eosNetwork = getNetworkName()

  switch (eosNetwork) {
    case `kylin`:
      return KylinNetwork;
    default:
    case `mainnet`:
      return MainNetwork;
  }
}

const network = getNetwork();

const rpc = new JsonRpc(network.nodeEndpoint, { fetch: fetch as any });

export { getNetwork, getNetworkName, rpc };

