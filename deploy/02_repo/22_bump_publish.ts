import buildMetadata2 from '../../contracts/metadata/build-metadata.json';
import releaseMetadata1 from '../../contracts/metadata/release-metadata.json';
import {addDeployedContract, getDeployedContracts} from '../../utils/helpers';
import {toHex} from '../../utils/ipfs-upload';
import {uploadToIPFS} from '../../utils/ipfs-upload';
import {PluginRepo__factory} from '@aragon/osx-ethers';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

const setupContract = 'LensVotingSetup';

const releaseId = 1;

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

  // Upload the metadata
  const releaseMetadataURI = `ipfs://${await uploadToIPFS(
    JSON.stringify(releaseMetadata1)
  )}`;
  const buildMetadataURI = `ipfs://${await uploadToIPFS(
    JSON.stringify(buildMetadata2)
  )}`;

  console.log(`Uploaded metadata of release 1: ${releaseMetadataURI}`);
  console.log(`Uploaded metadata of build 2: ${buildMetadataURI}`);

  // Get PluginSetup

  const setupBump = await deployments.get(setupContract);

  console.log('deployed ', getDeployedContracts()[networkName]['PluginRepo']);

  // Get PluginRepo
  const pluginRepo = PluginRepo__factory.connect(
    getDeployedContracts()[networkName]['PluginRepo'],
    deployer
  );

  // Create Version for Release 1 and Build 2
  await pluginRepo.createVersion(
    releaseId,
    setupBump.address,
    toHex(`ipfs://${await uploadToIPFS(JSON.stringify(buildMetadataURI))}`),
    toHex(`ipfs://${await uploadToIPFS(JSON.stringify(releaseMetadataURI))}`)
  );

  addDeployedContract(network.name, setupContract, setupBump.address);
};

export default func;
func.tags = ['bump'];
