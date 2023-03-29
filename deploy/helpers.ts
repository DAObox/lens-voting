import {
  PluginRepoFactory__factory,
  activeContractsList,
  PluginRepoRegistry,
  PluginRepoRegistry__factory,
} from "@aragon/osx-ethers";
import { Provider } from "@ethersproject/providers";
import { Signer } from "ethers";
import { ethers } from "hardhat";

type ContractAddresses = typeof activeContractsList;

interface NewPluginRepoParams {
  subdomain: string;
  setupAddress: string;
  deployer: string;
  networkName: string;
  signer: Signer | Provider;
  buildMetadataCid?: string;
  releaseMetadataCid?: string;
}

export async function newPluginRepo({
  subdomain,
  setupAddress,
  deployer,
  networkName,
  signer,
  buildMetadataCid = "",
  releaseMetadataCid = "",
}: NewPluginRepoParams) {
  const repoFactory = PluginRepoFactory__factory.connect(
    activeContractsList[networkName as keyof ContractAddresses]
      .PluginRepoFactory,
    signer
  );

  const pluginRepoRegistry: PluginRepoRegistry =
    PluginRepoRegistry__factory.connect(
      activeContractsList[networkName as keyof ContractAddresses]
        .PluginRepoRegistry,
      signer
    );

  const filter = pluginRepoRegistry.filters.PluginRepoRegistered();

  const eventPromise = new Promise<void>((resolve, reject) => {
    pluginRepoRegistry.on(filter, (eventSubdomain, pluginRepoAddress) => {
      // console.log(eventSubdomain, subdomain, pluginRepoAddress);
      if (eventSubdomain === subdomain) {
        console.log(
          `Generated repo contract address for ${eventSubdomain}: ${pluginRepoAddress}`
        );
        process.exit(0);
      }
    });
  });

  await repoFactory.createPluginRepoWithFirstVersion(
    subdomain,
    setupAddress,
    deployer,
    ethers.utils.toUtf8Bytes(buildMetadataCid),
    ethers.utils.toUtf8Bytes(releaseMetadataCid)
  );

  await eventPromise;
}
