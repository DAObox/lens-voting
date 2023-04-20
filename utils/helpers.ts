import {activeContractsList} from '@aragon/osx-ethers';
import {ContractFactory, ContractTransaction} from 'ethers';
import {
  Interface,
  LogDescription,
  defaultAbiCoder,
  keccak256,
} from 'ethers/lib/utils';
import {existsSync, statSync, readFileSync, writeFileSync} from 'fs';
import {ethers} from 'hardhat';
import {upgrades} from 'hardhat';
import fs from 'fs-extra';
import path from 'path';

export type NetworkNameMapping = {[index: string]: string};
export type ContractList = {[index: string]: {[index: string]: string}};

export const osxContracts: ContractList = activeContractsList;

export const networkNameMapping: NetworkNameMapping = {
  arbitrumOne: 'ERROR: Not available yet.',
  arbitrumGoerli: 'ERROR: Not available yet.',
  mainnet: 'mainnet',
  goerli: 'goerli',
  polygon: 'polygon',
  polygonMumbai: 'mumbai',
}; // TODO unify naming

export const ERRORS = {
  ALREADY_INITIALIZED: 'Initializable: contract is already initialized',
};

const deployedContractsFilePath = 'deployed_contracts.json';

export function getDeployedContracts(): ContractList {
  return JSON.parse(readFileSync(deployedContractsFilePath, 'utf-8'));
}

export function addDeployedContract(
  networkName: string,
  contractName: string,
  contractAddr: string
) {
  let deployedContracts: ContractList;

  // Check if the file exists and is not empty
  if (
    existsSync(deployedContractsFilePath) &&
    statSync(deployedContractsFilePath).size !== 0
  ) {
    deployedContracts = JSON.parse(
      readFileSync(deployedContractsFilePath, 'utf-8')
    );
  } else {
    deployedContracts = {};
  }

  if (!deployedContracts[networkName]) {
    deployedContracts[networkName] = {};
  }

  deployedContracts[networkName][contractName] = contractAddr;

  writeFileSync(
    'deployed_contracts.json',
    JSON.stringify(deployedContracts, null, 2) + '\n'
  );
}

export function toBytes(string: string) {
  return ethers.utils.formatBytes32String(string);
}

export function hashHelpers(helpers: string[]) {
  return keccak256(defaultAbiCoder.encode(['address[]'], [helpers]));
}

export async function findEvent<T>(tx: ContractTransaction, eventName: string) {
  const receipt = await tx.wait();

  const event = (receipt.events || []).find(event => event.event === eventName);

  return event as T | undefined;
}

export async function findEventTopicLog(
  tx: ContractTransaction,
  iface: Interface,
  eventName: string
): Promise<LogDescription> {
  const receipt = await tx.wait();
  const topic = iface.getEventTopic(eventName);
  const log = receipt.logs.find(x => x.topics.indexOf(topic) >= 0);
  if (!log) {
    throw new Error(`No logs found for this event ${eventName} topic.`);
  }
  return iface.parseLog(log);
}

type DeployOptions = {
  constructurArgs?: unknown[];
  proxyType?: 'uups';
};

export async function deployWithProxy<T>(
  contractFactory: ContractFactory,
  options: DeployOptions = {}
): Promise<T> {
  upgrades.silenceWarnings(); // Needed because we pass the `unsafeAllow: ["constructor"]` option.

  return upgrades.deployProxy(contractFactory, [], {
    kind: options.proxyType || 'uups',
    initializer: false,
    unsafeAllow: ['constructor'],
    constructorArgs: options.constructurArgs || [],
  }) as unknown as Promise<T>;
}

export async function findFactoryPath(
  contractName: string,
  basePath: string = path.join(process.cwd(), 'typechain')
): Promise<string | null> {
  // Find the root directory of the project

  const files = await fs.readdir(basePath);

  for (const file of files) {
    const filePath = path.join(basePath, file);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      const result = await findFactoryPath(contractName, filePath);
      if (result) {
        return result;
      }
    } else if (file === `${contractName}__factory.ts`) {
      return filePath;
    }
  }

  return null;
}
export async function loadFactories(
  setupContract: string,
  pluginContract: string
) {
  const setupFactoryPath = await findFactoryPath(setupContract);
  const pluginFactoryPath = await findFactoryPath(pluginContract);

  if (!setupFactoryPath || !pluginFactoryPath) {
    throw new Error('Factory files not found.');
  }

  if (!setupFactoryPath || !pluginFactoryPath) {
    throw new Error('Factory files not found.');
  }

  const setupModule = await import(setupFactoryPath);
  const pluginModule = await import(pluginFactoryPath);

  const SETUP_FACTORY = setupModule[`${setupContract}__factory`];
  const PLUGIN_FACTORY = pluginModule[`${pluginContract}__factory`];

  return {
    SETUP_FACTORY,
    PLUGIN_FACTORY,
  };
}
