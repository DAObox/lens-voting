import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
  deployments,
  getNamedAccounts,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log(`\n10: Creating LensVotingSetup.`);
  await deploy("LensVotingSetup", {
    from: deployer,
    log: true,
  });
};

export default func;
func.tags = ["CreateLensVotingSetup"];
