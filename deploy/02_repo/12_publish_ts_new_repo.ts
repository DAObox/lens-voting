import {
  networkNameMapping,
  osxContracts,
  findEventTopicLog,
  addDeployedContract,
} from '../../utils/helpers';
import {toHex, uploadToIPFS} from '../../utils/ipfs-upload';

import buildMetadata from '../../contracts/metadata/build-metadata.json';
import releaseMetadata from '../../contracts/metadata/release-metadata.json';

const setupContract = 'LensVotingSetup';
const pluginContract = 'LensVotingPlugin';

import {
  PluginRepoFactory__factory,
  PluginRepoRegistry__factory,
  PluginRepo__factory,
} from '@aragon/osx-ethers';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, network} = hre;
  const [deployer] = await hre.ethers.getSigners();

  const forkNetwork = process.env.HARDHAT_FORK_NETWORK as string;

  const networkName =
    network.name === 'localhost' ||
    network.name === 'hardhat' ||
    network.name === 'coverage'
      ? forkNetwork
      : network.name;

  // Get the plugin factory address
  let pluginRepoFactoryAddr: string;
  if (
    network.name === 'localhost' ||
    network.name === 'hardhat' ||
    network.name === 'coverage'
  ) {
    // TODO allow to select the network used for testing
    pluginRepoFactoryAddr =
      osxContracts[forkNetwork as string].PluginRepoFactory;
    console.log(
      `Using the ${networkName} PluginRepoFactory address (${pluginRepoFactoryAddr}) for deployment testing on network ${networkName}`
    );
  } else {
    pluginRepoFactoryAddr =
      osxContracts[networkNameMapping[networkName]].PluginRepoFactory;

    console.log(
      `Using the ${networkNameMapping[networkName]} PluginRepoFactory address (${pluginRepoFactoryAddr}) for deployment...`
    );
  }

  const pluginRepoFactory = PluginRepoFactory__factory.connect(
    pluginRepoFactoryAddr,
    deployer
  );

  // Upload the metadata
  const releaseMetadataURI = `ipfs://${await uploadToIPFS(
    JSON.stringify(releaseMetadata)
  )}`;
  const buildMetadataURI = `ipfs://${await uploadToIPFS(
    JSON.stringify(buildMetadata)
  )}`;

  console.log(`Uploaded metadata of release 1: ${releaseMetadataURI}`);
  console.log(`Uploaded metadata of build 1: ${buildMetadataURI}`);

  const setupR1B1 = await deployments.get(setupContract);

  // Create Repo for Release 1 and Build 1
  const tx = await pluginRepoFactory.createPluginRepoWithFirstVersion(
    'lens',
    setupR1B1.address,
    deployer.address,
    toHex(releaseMetadataURI),
    toHex(buildMetadataURI)
  );
  const eventLog = await findEventTopicLog(
    tx,
    PluginRepoRegistry__factory.createInterface(),
    'PluginRepoRegistered'
  );
  if (!eventLog) {
    throw new Error('Failed to get PluginRepoRegistered event log');
  }

  const pluginRepo = PluginRepo__factory.connect(
    eventLog.args.pluginRepo,
    deployer
  );

  console.log(
    `"${pluginContract}" PluginRepo deployed at: ${pluginRepo.address} with `
  );

  addDeployedContract(networkName, 'PluginRepo', pluginRepo.address);
  addDeployedContract(networkName, setupContract, setupR1B1.address);
};

export default func;
func.tags = [`${pluginContract}Repo`, `Publish${pluginContract}R1B1`];
