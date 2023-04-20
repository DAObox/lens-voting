import {addDeployedContract} from '../../utils/helpers';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

const name = 'LensVotingSetup';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log(`${name}`);

  const {deployments, network, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  const result = await deploy(name, {
    from: deployer,
    args: [],
    log: true,
  });

  console.log('result ', result.address);

  addDeployedContract(network.name, name, result.address);
};

export default func;
func.tags = ['bump'];
