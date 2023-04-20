import {DeployFunction} from 'hardhat-deploy/types';

import {HardhatRuntimeEnvironment} from 'hardhat/types';

import {createDaoHelpers} from '../../utils/dao-helpers';
import {uploadToIPFS} from '../../utils/ipfs-upload';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {
    getAdminPluginInstallData,
    createTokenVotingProposal,
    createInstallActions,
  } = createDaoHelpers(hre);

  const pluginAddress = '0x8eaf189dbe3524667d25684645aba1c71c02d8db';
  const daoAddress = '0x6f07aa7af27e0e06a08a1a17e04c4b0eb11300ab';

  const proposalMetadata = {
    title: 'Install Admin Plugin',
    summary: 'Install Admin Plugin',
    description: 'Install Admin Plugin',
    resources: [],
    media: [],
  };

  const metadataUri = await uploadToIPFS(JSON.stringify(proposalMetadata));

  const adminPluginData = await getAdminPluginInstallData();
  const actions = await createInstallActions(daoAddress, adminPluginData);

  await createTokenVotingProposal(pluginAddress, {
    metadataUri,
    actions,
    allowFalureMap: BigInt(0),
    endTimestamp: BigInt(Math.floor(new Date().getTime() + 60 * 60 * 24 * 2)),
  });
};

export default func;
func.tags = ['Install_Admin'];
