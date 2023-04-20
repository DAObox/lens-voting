import {PluginSetupProcessor} from './../typechain/@aragon/osx/framework/plugin/setup/PluginSetupProcessor';
import {
  DAOFactory,
  DAORegistry__factory,
  activeContractsList,
  DAOFactory__factory,
  PluginRepo,
  PluginRepo__factory,
  MajorityVotingBase,
  PluginSetupProcessor__factory,
  TokenVoting__factory,
  DAO__factory,
} from '@aragon/osx-ethers';
import {defaultAbiCoder} from '@ethersproject/abi';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {ADDRESS_ZERO} from '../test/simple-storage/simple-storage-common';
import {findEventTopicLog} from './helpers';
import {hexToBytes} from './strings';
import {toUtf8Bytes} from '@ethersproject/strings';
import {Address} from 'hardhat-deploy/types';
import * as pc from 'picocolors';
import {BigNumber, BigNumberish} from 'ethers';
import {ContractVotingSettings, VotingSettings, VotingMode} from './types';
import {keccak256} from 'ethers/lib/utils';

const FORK_NETWORK = 'goerli';

const green = pc.green;
const yellow = pc.yellow;
const italic = pc.italic;
const red = pc.red;
const bold = pc.bold;

class DAOHelpers {
  private hre: HardhatRuntimeEnvironment;

  constructor(hre: HardhatRuntimeEnvironment) {
    this.hre = hre;
  }

  public async createDao(
    daoSettings: DAOFactory.DAOSettingsStruct,
    installItems: Array<DAOFactory.PluginSettingsStruct>
  ) {
    logCreating();
    const [deployer] = await this.hre.ethers.getSigners();
    const {metadata, ...rest} = daoSettings;

    const factory = await this.daoFactory();
    const tx = await factory.createDao(
      {
        metadata: toUtf8Bytes(`ipfs://${daoSettings.metadata}`),
        ...rest,
      },
      installItems
    );
    const txHash = tx.hash;

    await tx.wait();

    const iface = DAORegistry__factory.createInterface();

    const {dao, creator, subdomain} = (
      await findEventTopicLog(tx, iface, 'DAORegistered')
    ).args;

    logDAO({dao, subdomain, txHash, network: this.hre.network.name});
    return dao;
  }

  public async daoFactory() {
    const {hre} = this;
    const {network} = hre;
    const [deployer] = await hre.ethers.getSigners();

    const daoFactoryAddress =
      network.name === 'localhost' ||
      network.name === 'hardhat' ||
      network.name === 'coverage'
        ? activeContractsList[FORK_NETWORK].DAOFactory
        : activeContractsList[network.name as keyof typeof activeContractsList]
            .DAOFactory;

    return DAOFactory__factory.connect(daoFactoryAddress, deployer);
  }

  public async PluginSetupProcessor() {
    const {hre} = this;
    const {network} = hre;
    const [deployer] = await hre.ethers.getSigners();

    const address =
      network.name === 'localhost' ||
      network.name === 'hardhat' ||
      network.name === 'coverage'
        ? activeContractsList[FORK_NETWORK].PluginSetupProcessor
        : activeContractsList[network.name as keyof typeof activeContractsList]
            .PluginSetupProcessor;

    return PluginSetupProcessor__factory.connect(address, deployer);
  }

  public async prepareInstalationAction(daoAddress, setup) {
    const psp = await this.PluginSetupProcessor();
    const tx = await psp.prepareInstallation(daoAddress, setup);
    await tx.wait();

    const event = (
      await findEventTopicLog(tx, psp.interface, 'InstallationPrepared')
    ).args;

    const {plugin, pluginSetupRepo, versionTag, preparedSetupData} = event;
    const {helpers, permissions} = preparedSetupData;

    const preparedData: PluginSetupProcessor.ApplyInstallationParamsStruct = {
      plugin,
      pluginSetupRef: {pluginSetupRepo, versionTag},
      permissions,
      helpersHash: keccak256(defaultAbiCoder.encode(['address[]'], [helpers])),
    };

    return preparedData;
  }

  public async applyInstalationAction(
    daoAddress: Address,
    args: PluginSetupProcessor.ApplyInstallationParamsStruct
  ) {
    const psp = await this.PluginSetupProcessor();
    const pspInterface = psp.interface;

    const hexBytes = pspInterface.encodeFunctionData('applyInstallation', [
      daoAddress,
      args,
    ]);

    return {
      to: psp.address,
      value: 0n,
      data: hexToBytes(hexBytes),
    };
  }

  public async createInstallActions(daoAddress: Address, pluginData: any) {
    const who = (await this.PluginSetupProcessor()).address;

    const preparedData = await this.prepareInstalationAction(
      daoAddress,
      pluginData
    );

    const action = await this.applyInstalationAction(daoAddress, preparedData);
    return [
      grantAction({
        daoAddress,
        params: {where: daoAddress, who, permission: 'ROOT_PERMISSION'},
      }),
      action,
      revokeAction({
        daoAddress,
        params: {where: daoAddress, who, permission: 'ROOT_PERMISSION'},
      }),
    ];
  }

  public async getAdminPluginInstallData(
    address?: Address
  ): Promise<DAOFactory.PluginSettingsStruct> {
    const {hre, getPluginSetupRef} = this;
    const [deployer] = await hre.ethers.getSigners();

    const admin = address ? address : deployer.address;
    console.group();
    console.log('\n' + italic('Preparing Admin plugin...'));
    console.log(green(`Using admin address: ${red(bold(admin))}\n`));
    console.groupEnd();
    const deployemnt = defaultAbiCoder.encode(['address'], [admin]);

    return {
      pluginSetupRef: await getPluginSetupRef(await this.getRepo('admin-repo')),
      data: hexToBytes(deployemnt),
    };
  }

  public async getTokenVotingInstallData(args: any) {
    const abi = [
      'tuple(uint8 votingMode, uint64 supportThreshold, uint64 minParticipation, uint64 minDuration, uint256 minProposerVotingPower) votingSettings',
      'tuple(address addr, string name, string symbol) tokenSettings',
      'tuple(address[] receivers, uint256[] amounts) mintSettings',
    ];

    const params = tokenVotingInitParamsToContract(args);

    const deployemnt = defaultAbiCoder.encode(abi, params);

    return {
      pluginSetupRef: await this.getPluginSetupRef(
        await this.getRepo('token-voting-repo')
      ),
      data: hexToBytes(deployemnt),
    };
  }

  public async getRepo(repo: MainnetRepos | PolygonRepos) {
    const {hre} = this;
    const {network} = hre;
    const [deployer] = await hre.ethers.getSigners();

    const address =
      network.name === 'localhost' ||
      network.name === 'hardhat' ||
      network.name === 'coverage'
        ? // @ts-ignore
          activeContractsList[FORK_NETWORK][repo]
        : // @ts-ignore
          activeContractsList[network.name as keyof typeof activeContractsList][
            repo
          ];

    return PluginRepo__factory.connect(address, deployer) as PluginRepo;
  }

  public async getPluginSetupRef(repo: PluginRepo) {
    const currentRelease = await repo.latestRelease();
    const latestVersion = await repo['getLatestVersion(uint8)'](currentRelease);

    return {
      pluginSetupRepo: repo.address,
      versionTag: latestVersion.tag,
    };
  }

  public async tokenVotingPlugin(address: string) {
    const [deployer] = await this.hre.ethers.getSigners();

    return TokenVoting__factory.connect(address, deployer);
  }

  public async createTokenVotingProposal(
    pluginAddress: string,
    args: TokenVotingProposalArgs
  ) {
    const plugin = await this.tokenVotingPlugin(pluginAddress);
    const {
      metadataUri,
      actions = [],
      allowFalureMap = 0n,
      startTimestamp = 0n,
      endTimestamp,
      creatorVote = 0n,
      executeOnPass = false,
    } = args;

    const tx = await plugin.createProposal(
      toUtf8Bytes(metadataUri),
      actions,
      allowFalureMap,
      startTimestamp,
      endTimestamp, // 1682011381000n,
      creatorVote, //0n,
      executeOnPass
    );

    await tx.wait();
    console.log('txHash', tx.hash);
  }
}

export function createDaoHelpers(hre: HardhatRuntimeEnvironment) {
  const daoHelpers = new DAOHelpers(hre);

  return {
    getRepo: daoHelpers.getRepo.bind(daoHelpers),
    getAdminPluginInstallData:
      daoHelpers.getAdminPluginInstallData.bind(daoHelpers),
    createDao: daoHelpers.createDao.bind(daoHelpers),
    daoFactory: daoHelpers.daoFactory.bind(daoHelpers),
    getPluginSetupRef: daoHelpers.getPluginSetupRef.bind(daoHelpers),
    getTokenVotingInstallData:
      daoHelpers.getTokenVotingInstallData.bind(daoHelpers),
    PluginSetupProcessor: daoHelpers.PluginSetupProcessor.bind(daoHelpers),
    prepareInstalationAction:
      daoHelpers.prepareInstalationAction.bind(daoHelpers),
    applyInstalationAction: daoHelpers.applyInstalationAction.bind(daoHelpers),
    createTokenVotingProposal:
      daoHelpers.createTokenVotingProposal.bind(daoHelpers),
    createInstallActions: daoHelpers.createInstallActions.bind(daoHelpers),
  };
}

interface TokenVotingProposalArgs {
  metadataUri: string;
  actions: any[];
  allowFalureMap?: BigNumberish;
  startTimestamp?: BigNumberish;
  endTimestamp: BigNumberish;
  creatorVote?: BigNumberish;
  executeOnPass?: boolean;
}

interface ActionParams {
  daoAddress: string;
  params: {
    where: string;
    who: string;
    permission: string;
  };
}

export function grantAction(action: ActionParams) {
  const {daoAddress, params} = action;
  const {where, who, permission} = params;
  const daoInterface = DAO__factory.createInterface();
  const args = [where, who, keccak256(toUtf8Bytes(permission))];

  const hexBytes = daoInterface.encodeFunctionData('grant', args);
  return {
    to: daoAddress,
    value: BigInt(0),
    data: hexToBytes(hexBytes),
  };
}

export function revokeAction(action: ActionParams) {
  const {daoAddress, params} = action;
  const {where, who, permission} = params;
  const daoInterface = DAO__factory.createInterface();
  const args = [where, who, keccak256(toUtf8Bytes(permission))];

  const hexBytes = daoInterface.encodeFunctionData('revoke', args);
  return {
    to: daoAddress,
    value: BigInt(0),
    data: hexToBytes(hexBytes),
  };
}

type MainnetRepos =
  | keyof typeof activeContractsList.mainnet
  | keyof typeof activeContractsList.goerli;

type PolygonRepos =
  | keyof typeof activeContractsList.polygon
  | keyof typeof activeContractsList.mumbai;

export function tokenVotingInitParamsToContract(params: any): any {
  let token: [string, string, string] = ['', '', ''];
  let balances: [string[], BigNumber[]] = [[], []];
  if (params.newToken) {
    token = [ADDRESS_ZERO, params.newToken.name, params.newToken.symbol];
    balances = [
      params.newToken.balances.map(balance => balance.address),
      params.newToken.balances.map(({balance}) => BigNumber.from(balance)),
    ];
  } else if (params.useToken) {
    token = [params.useToken?.address, '', ''];
  }
  return [
    Object.values(
      votingSettingsToContract(params.votingSettings)
    ) as ContractVotingSettings,
    token,
    balances,
  ];
}

export function votingSettingsToContract(
  params: VotingSettings
): MajorityVotingBase.VotingSettingsStruct {
  return {
    votingMode: BigNumber.from(
      votingModeToContracts(params?.votingMode || VotingMode.STANDARD)
    ),
    supportThreshold: encodeRatio(params.supportThreshold, 6),
    minParticipation: encodeRatio(params.minParticipation, 6),
    minDuration: BigNumber.from(params.minDuration),
    minProposerVotingPower: BigNumber.from(params.minProposerVotingPower || 0),
  };
}

/**
 * Encodes a 0-1 ratio within the given digit precision for storage on a smart contract
 *
 * @export
 * @param {number} ratio
 * @param {number} digits
 * @return {*}  {bigint}
 */
export function encodeRatio(ratio: number, digits: number): number {
  if (ratio < 0 || ratio > 1) {
    throw new Error('The ratio value should range between 0 and 1');
  } else if (!Number.isInteger(digits) || digits < 1 || digits > 15) {
    throw new Error('The number of digits should range between 1 and 15');
  }
  return Math.round(ratio * 10 ** digits);
}

export function votingModeToContracts(votingMode: VotingMode): number {
  switch (votingMode) {
    case VotingMode.STANDARD:
      return 0;
    case VotingMode.EARLY_EXECUTION:
      return 1;
    case VotingMode.VOTE_REPLACEMENT:
      return 2;
    default:
      throw new Error('Invalid voting mode');
  }
}
export function votingModeFromContracts(votingMode: number): VotingMode {
  switch (votingMode) {
    case 0:
      return VotingMode.STANDARD;
    case 1:
      return VotingMode.EARLY_EXECUTION;
    case 2:
      return VotingMode.VOTE_REPLACEMENT;
    default:
      throw new Error('Invalid voting mode');
  }
}

const logDAO = ({dao, subdomain, txHash, network}) => {
  console.log(`
${red(bold('TX '))} ${italic(txHash)}
${red(bold('ENS'))} ${italic(`${subdomain}.dao.eth`)}
\n
${yellow(`app.aragon.org/#/daos/${network}/${dao}/dashboard`)}
    `);
};

const logCreating = () => {
  console.log(`\n 
          ${green('🚧🚧🚧 ----------- Building DAO ----------- 🚧🚧🚧')}
  `);
};
