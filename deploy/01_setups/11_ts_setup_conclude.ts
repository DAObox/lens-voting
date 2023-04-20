import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {setTimeout} from 'timers/promises';
import {loadFactories} from '../../utils/helpers';

const setupContract = 'LensVotingSetup';
const pluginContract = 'LensVotingPlugin';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log(`Concluding ${setupContract} setup deployment.\n`);
  const [deployer] = await hre.ethers.getSigners();

  const {deployments, network} = hre;

  const {SETUP_FACTORY, PLUGIN_FACTORY} = await loadFactories(
    setupContract,
    pluginContract
  );

  const setupDeployment = await deployments.get(`${setupContract}`);
  const setup = SETUP_FACTORY.connect(setupDeployment.address, deployer);
  const implementation = PLUGIN_FACTORY.connect(
    await setup.implementation(),
    deployer
  );

  // Add a timeout for polygon because the call to `implementation()` can fail for newly deployed contracts in the first few seconds
  if (network.name === 'polygon') {
    console.log(`Waiting 30secs for ${network.name} to finish up...`);
    await setTimeout(30000);
  }

  hre.aragonToVerifyContracts.push({
    address: setupDeployment.address,
    args: setupDeployment.args,
  });
  hre.aragonToVerifyContracts.push({
    address: implementation.address,
    args: [],
  });
};

export default func;
func.tags = [setupContract, 'Verify'];
