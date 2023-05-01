import {LensVotingPlugin__factory} from './../typechain/factories/contracts/LensVotingPlugin__factory';
import {IFollowNFT__factory} from './../typechain/factories/contracts/interfaces/IFollowNFT__factory';
import {uploadToIPFS} from '../utils/ipfs-upload';
import {toUtf8Bytes} from '@ethersproject/strings';

import hre from 'hardhat';

const creationTx =
  '0x7b8ffa68a60b90ceccb2eeefac365b1793a66dcae2d9f1af96c595190cdf9916';
const DaoBoxFollowNft = '0x03bD27B6FE4f0B3F2C2C9a4289cA2bfcE1DDE95c';
const DAO_ADDRESS = '0x438e1f30F3797Be4b94577d84Fa4A62fAc77feC8';

const lensPlugin = '0x65f2fb8361b9f35dcb9f29e620607f82e5abbf0e';
const adminPlugin = '0xc1b5edb884bb246ce4ea087aef8906460d6a866a';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const votingToken = IFollowNFT__factory.connect(DaoBoxFollowNft, deployer);
  const lensVoting = LensVotingPlugin__factory.connect(lensPlugin, deployer);
  const tokenAddress = await lensVoting.getVotingToken();

  // create a vote metadata
  const metadata = {
    title: 'Test Proposal',
    summary: 'This is a short description',
    description: 'This is a long description',
    resources: [
      {
        name: 'Discord',
        url: 'https://discord.com/...',
      },
      {
        name: 'Website',
        url: 'https://website...',
      },
    ],
    media: {
      logo: 'https://...',
      header: 'https://...',
    },
  };
  const metadataUri = toUtf8Bytes(await uploadToIPFS(JSON.stringify(metadata)));
  console.log('metadataUriBytes', metadataUri);

  // create a proposal
  const vote = await lensVoting.createProposal(
    metadataUri,
    [],
    0,
    0,
    0,
    0,
    false
  );
  console.log('vote', vote.hash);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
