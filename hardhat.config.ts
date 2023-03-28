import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-etherscan";
import "@typechain/hardhat";
import "hardhat-deploy";
import "@openzeppelin/hardhat-upgrades";

dotenv.config();

const ETH_KEY = process.env.ETH_KEY;
const accounts = ETH_KEY ? ETH_KEY.split(",") : [];

const networks = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./networks.json"), "utf8")
);

// add accounts to network configs
for (const network of Object.keys(networks)) {
  networks[network].accounts = accounts;
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const config = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 2000,
      },
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    local: {
      url: "http://localhost:8545",
      maxPriorityFeePerGas: "2 gwei",
      maxFeePerGas: "100 gwei",
    },
    hardhat: {
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      blockGasLimit: 3000000000, // really high to test some things that are only possible with a higher block gas limit
      gasPrice: 8000000000,
    },
    ...networks,
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_KEY || "",
      goerli: process.env.ETHERSCAN_KEY || "",
      polygon: process.env.POLYGONSCAN_KEY || "",
      polygonMumbai: process.env.POLYGONSCAN_KEY || "",
    },
    customChains: [],
  },
  namedAccounts: {
    deployer: 0,
  },
};

export default config;
