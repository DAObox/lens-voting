import {DeployFunction} from 'hardhat-deploy/types';
import {DAOFactory} from '@aragon/osx-ethers';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

import {
  createDaoHelpers,
  tokenVotingInitParamsToContract,
} from '../../utils/dao-helpers';
import {uploadToIPFS} from '../../utils/ipfs-upload';
import {ADDRESS_ZERO} from '../../test/simple-storage/simple-storage-common';
import {addDeployedContract} from '../../utils/helpers';
import {VotingMode} from '../../utils/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {network} = hre;
  const {
    getAdminPluginInstallData,
    createDao,
    getTokenVotingInstallData,
    prepareInstalationAction,
    applyInstalationAction,
  } = createDaoHelpers(hre);

  const [deployer] = await hre.ethers.getSigners();

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
  1;
  const tvInstallData = await getTokenVotingInstallData({
    votingSettings: {
      minDuration: 60 * 60 * 24 * 2, // seconds (minimum amount is 3600)
      minParticipation: 0.25, // 25%
      supportThreshold: 0.5, // 50%
      minProposerVotingPower: BigInt('5000'), // default 0
      votingMode: VotingMode.EARLY_EXECUTION, // default is STANDARD. other options: EARLY_EXECUTION, VOTE_REPLACEMENT
    },
    newToken: {
      name: 'Token', // the name of your token
      symbol: 'TOK', // the symbol for your token. shouldn't be more than 5 letters
      decimals: 18, // the number of decimals your token uses
      balances: [
        {
          // Defines the initial balances of the new token
          address: deployer.address, // address of the account to receive the newly minted tokens
          balance: BigInt(10), // amount of tokens that address should receive
        },
      ],
    },
  });

  const dao = await createDao(daoSettings, [tvInstallData]);

  const adminPluginData = await getAdminPluginInstallData();

  const preparedData = await prepareInstalationAction(dao, adminPluginData);
  // console.log('prepared data', preparedData);
  const applyAction = await applyInstalationAction(dao, preparedData);
  console.log('apply action', applyAction);

  // addDeployedContract(network.name, 'TokenVotingDAO', dao);
};

export default func;
func.tags = ['TV_DAO'];
