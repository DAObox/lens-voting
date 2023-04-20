import {DeployFunction} from 'hardhat-deploy/types';
import {DAOFactory} from '@aragon/osx-ethers';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

import {createDaoHelpers} from '../../utils/dao-helpers';
import {uploadToIPFS} from '../../utils/ipfs-upload';
import {ADDRESS_ZERO} from '../../test/simple-storage/simple-storage-common';
import {addDeployedContract} from '../../utils/helpers';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {network} = hre;
  const {getAdminPluginInstallData, createDao} = createDaoHelpers(hre);

  // 01. set dao metadata
  const daoMetadata = {
    name: 'DAO Box',
    description: 'DAOBox Maxi',
    links: [],
  };

  // 02. set dao settings
  const daoSettings: DAOFactory.DAOSettingsStruct = {
    metadata: await uploadToIPFS(JSON.stringify(daoMetadata)),
    subdomain: 'testingggg' + Math.floor(Math.random() * 1000000),
    trustedForwarder: ADDRESS_ZERO,
    daoURI: 'https://daobox.app',
  };

  const installData = await getAdminPluginInstallData();

  const dao = await createDao(daoSettings, [installData]);

  addDeployedContract(network.name, 'Admin_DAO', dao);
};

export default func;
func.tags = ['Admin_DAO'];
