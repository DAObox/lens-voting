// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.17;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IVotesUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/utils/IVotesUpgradeable.sol";

import {IDAO} from "@aragon/osx/core/dao/IDAO.sol";
import {DAO} from "@aragon/osx/core/dao/DAO.sol";
import {PermissionLib} from "@aragon/osx/core/permission/PermissionLib.sol";
import {PluginSetup, IPluginSetup} from "@aragon/osx/framework/plugin/setup/PluginSetup.sol";
import {GovernanceERC20} from "@aragon/osx/token/ERC20/governance/GovernanceERC20.sol";
import {GovernanceWrappedERC20} from "@aragon/osx/token/ERC20/governance/GovernanceWrappedERC20.sol";
import {IGovernanceWrappedERC20} from "@aragon/osx/token/ERC20/governance/IGovernanceWrappedERC20.sol";
import {MajorityVotingBase} from "@aragon/osx/plugins/governance/majority-voting/MajorityVotingBase.sol";
import {IFollowNFT} from "./interfaces/IFollowNFT.sol";
import {LensVotingPlugin} from "./LensVotingPlugin.sol";


/// @title LensVotingSetup
/// @author DAO BOX
/// @notice The setup contract of the `LensVotingPlugin` contract.
contract LensVotingSetup is PluginSetup {
    using Address for address;
    using Clones for address;
    using ERC165Checker for address;

    /// @notice The address of the `LensVotingPlugin` base contract.
    LensVotingPlugin private immutable lensVotingBase;


    /// @notice Thrown if token address is passed which is not a token.
    /// @param token The token address
    error TokenNotContract(address token);

    /// @notice Thrown if token address is not ERC20.
    /// @param token The token address
    error TokenNotERC20(address token);

    /// @notice Thrown if passed helpers array is of worng length.
    /// @param length The array length of passed helpers.
    error WrongHelpersArrayLength(uint256 length);

    /// @notice The contract constructor, that deployes the bases.
    constructor() {
        lensVotingBase = new LensVotingPlugin();
    }

    /// @inheritdoc IPluginSetup
    function prepareInstallation(
        address _dao,
        bytes calldata _data
    ) external returns (address plugin, PreparedSetupData memory preparedSetupData) {
        // Decode `_data` to extract the params needed for deploying and initializing `LensVotingPlugin` plugin,
        // and the required helpers
        (MajorityVotingBase.VotingSettings memory votingSettings,IFollowNFT votingToken) = abi.decode(
            _data, (MajorityVotingBase.VotingSettings, IFollowNFT));


        // Prepare and deploy plugin proxy.
        plugin = createERC1967Proxy(
            address(lensVotingBase),
            abi.encodeWithSelector(LensVotingPlugin.initialize.selector, _dao, votingSettings, votingToken)
        );

        // Prepare permissions
        PermissionLib.MultiTargetPermission[]
            memory permissions = new PermissionLib.MultiTargetPermission[](3);

        // Set plugin permissions to be granted.
        // Grant the list of prmissions of the plugin to the DAO.
        permissions[0] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            lensVotingBase.UPDATE_VOTING_SETTINGS_PERMISSION_ID()
        );

        permissions[1] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            lensVotingBase.UPGRADE_PLUGIN_PERMISSION_ID()
        );

        // Grant `EXECUTE_PERMISSION` of the DAO to the plugin.
        permissions[2] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Grant,
            _dao,
            plugin,
            PermissionLib.NO_CONDITION,
            DAO(payable(_dao)).EXECUTE_PERMISSION_ID()
        );



        preparedSetupData.permissions = permissions;
    }

    /// @inheritdoc IPluginSetup
    function prepareUninstallation(
        address _dao,
        SetupPayload calldata _payload
    ) external view returns (PermissionLib.MultiTargetPermission[] memory permissions) {
        // Prepare permissions.
        uint256 helperLength = _payload.currentHelpers.length;
        if (helperLength != 0) {
            revert WrongHelpersArrayLength({length: helperLength});
        }

        // token can be either GovernanceERC20, GovernanceWrappedERC20, or IVotesUpgradeable, which
        // does not follow the GovernanceERC20 and GovernanceWrappedERC20 standard.
        address token = _payload.currentHelpers[0];

        bool[] memory supportedIds = _getTokenInterfaceIds(token);

        bool isGovernanceERC20 = supportedIds[0] && supportedIds[1] && !supportedIds[2];

        permissions = new PermissionLib.MultiTargetPermission[](isGovernanceERC20 ? 4 : 3);

        // Set permissions to be Revoked.
        permissions[0] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            _payload.plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            lensVotingBase.UPDATE_VOTING_SETTINGS_PERMISSION_ID()
        );

        permissions[1] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            _payload.plugin,
            _dao,
            PermissionLib.NO_CONDITION,
            lensVotingBase.UPGRADE_PLUGIN_PERMISSION_ID()
        );

        permissions[2] = PermissionLib.MultiTargetPermission(
            PermissionLib.Operation.Revoke,
            _dao,
            _payload.plugin,
            PermissionLib.NO_CONDITION,
            DAO(payable(_dao)).EXECUTE_PERMISSION_ID()
        );

    }

    /// @inheritdoc IPluginSetup
    function implementation() external view virtual override returns (address) {
        return address(lensVotingBase);
    }

    /// @notice Retrieves the interface identifiers supported by the token contract.
    /// @dev It is crucial to verify if the provided token address represents a valid contract before using the below.
    /// @param token The token address
    function _getTokenInterfaceIds(address token) private view returns (bool[] memory) {
        bytes4[] memory interfaceIds = new bytes4[](1);
        interfaceIds[0] = type(IFollowNFT).interfaceId;
        return token.getSupportedInterfaces(interfaceIds);
    }


        function _isIFollowNFT(address token) private view returns (bool) {
        // We can use any function selector from the IFollowNFT interface
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSelector(IFollowNFT.getPowerByBlockNumber.selector, address(this), 0)
        );
        return success && data.length == 0x20;
    }
}