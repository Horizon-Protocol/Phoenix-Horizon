'use strict';

const w3utils = require('web3-utils');
const abiDecoder = require('abi-decoder');

// load the data in explicitly (not programmatically) so webpack knows what to bundle
const data = {
	testnet: require('./publish/deployed/testnet'),
	mainnet: require('./publish/deployed/mainnet'),
	goerli: require('./publish/deployed/goerli'),
	mumbai: require('./publish/deployed/mumbai'),
	sepolia: require('./publish/deployed/sepolia'),
};

const assets = require('./publish/assets.json');
const nonUpgradeable = require('./publish/non-upgradeable.json');
const releases = require('./publish/releases.json');
const sepolia = require('./publish/deployed/sepolia');

const networks = ['local', 'testnet', 'mainnet', 'goerli', 'mumbai', 'sepolia'];

const chainIdMapping = Object.entries({
	56: {
		network: 'mainnet',
	},
	97: {
		network: 'testnet',
	},
	5: {
		network: 'goerli',
	},
	80001: {
		network: 'mumbai',
	},
	421614: {
		network: 'sepolia',
	},
	// Hardhat fork of mainnet: https://hardhat.org/config/#hardhat-network
	31337: {
		network: 'mainnet',
		fork: true,
	},

	// now append any defaults
}).reduce((memo, [id, body]) => {
	memo[id] = Object.assign({ useOvm: false, fork: false }, body);
	return memo;
}, {});

/** @type {(obj: {id: number} | number) => number} */
const getNetworkFromId = obj => {
	const id = typeof obj === 'number' ? obj : obj.id;
	return chainIdMapping[id];
};
const networkToChainId = Object.entries(chainIdMapping).reduce(
	(memo, [id, { network, useOvm, fork }]) => {
		memo[network + (useOvm ? '-ovm' : '') + (fork ? '-fork' : '')] = id;
		return memo;
	},
	{}
);

const constants = {
	BUILD_FOLDER: 'build',
	CONTRACTS_FOLDER: 'contracts',
	MIGRATIONS_FOLDER: 'migrations',
	COMPILED_FOLDER: 'compiled',
	FLATTENED_FOLDER: 'flattened',
	AST_FOLDER: 'ast',

	CONFIG_FILENAME: 'config.json',
	RELEASES_FILENAME: 'releases.json',
	PARAMS_FILENAME: 'params.json',
	SYNTHS_FILENAME: 'synths.json',
	STAKING_REWARDS_FILENAME: 'rewards.json',
	SHORTING_REWARDS_FILENAME: 'shorting-rewards.json',
	OWNER_ACTIONS_FILENAME: 'owner-actions.json',
	DEPLOYMENT_FILENAME: 'deployment.json',
	VERSIONS_FILENAME: 'versions.json',
	FEEDS_FILENAME: 'feeds.json',
	OFFCHAIN_FEEDS_FILENAME: 'offchain-feeds.json',
	FUTURES_MARKETS_FILENAME: 'futures-markets.json',
	PERPS_V2_MARKETS_FILENAME: 'perpsv2-markets.json',

	AST_FILENAME: 'asts.json',

	ZERO_ADDRESS: '0x' + '0'.repeat(40),
	ZERO_BYTES32: '0x' + '0'.repeat(64),

	// inflationStartTimestampInSecs: 1551830400, // 2019-03-06T00:00:00Z
	inflationStartTimestampInSecs: 1672448400,
};

const knownAccounts = {
	mainnet: [
		{
			name: 'binance', // Binance 8 Wallet
			address: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
		},
		{
			name: 'renBTCWallet', // KeeperDAO wallet (has renBTC and ETH)
			address: '0xfCe146bF3146100cfe5dB4129cf6C82b0eF4Ad8c',
		},
		{
			name: 'loansAccount',
			address: '0x62f7A1F94aba23eD2dD108F8D23Aa3e7d452565B',
		},
	],
};

// The solidity defaults are managed here in the same format they will be stored, hence all
// numbers are converted to strings and those with 18 decimals are also converted to wei amounts
const defaults = {
	TEMP_OWNER_DEFAULT_DURATION: 60 * 60 * 24 * 60, // 60 days
	WAITING_PERIOD_SECS: '0', // (60 * 5).toString(), // 5 mins
	PRICE_DEVIATION_THRESHOLD_FACTOR: w3utils.toWei('3'),
	TRADING_REWARDS_ENABLED: false,
	ISSUANCE_RATIO: w3utils.toBN(1).mul(w3utils.toBN(1e18)).div(w3utils.toBN(3)).toString(), // 1/3 = 0.3333333333  // 300% ratio
	FEE_PERIOD_DURATION: (3600 * 24 * 7).toString(), // 1 week
	TARGET_THRESHOLD: '1', // 1% target threshold (it will be converted to a decimal when set)
	LIQUIDATION_DELAY: (3600 * 8).toString(), // 8 hours
	LIQUIDATION_RATIO: w3utils.toBN(1).mul(w3utils.toBN(2e18)).div(w3utils.toBN(3)).toString(), // 2/3 = 0.6666666667 // 150% ratio
	LIQUIDATION_ESCROW_DURATION: (3600 * 24 * 30 * 6).toString(), // 6 months
	LIQUIDATION_PENALTY: w3utils.toWei('0.1'), // 10% penalty (used for Collateral liquidations)
	SNX_LIQUIDATION_PENALTY: w3utils.toWei('0.6'), // 60% penalty (used for SNX Liquidations)
	SELF_LIQUIDATION_PENALTY: w3utils.toWei('0.5'), // 50% penalty
	FLAG_REWARD: w3utils.toWei('100'), // 100 HZN
	LIQUIDATE_REWARD: w3utils.toWei('200'), // 200 HZN
	RATE_STALE_PERIOD: (3600 * 24).toString(), // 24 hours
	EXCHANGE_FEE_RATES: {
		forex: w3utils.toWei('0.003'),
		commodity: w3utils.toWei('0.003'),
		equities: w3utils.toWei('0.003'),
		crypto: w3utils.toWei('0.025'),
		index: w3utils.toWei('0.01'),
	},
	EXCHANGE_DYNAMIC_FEE_THRESHOLD: w3utils.toWei('0.0025'), // 40 bps
	EXCHANGE_DYNAMIC_FEE_WEIGHT_DECAY: w3utils.toWei('0.95'), // dynamic fee weight decay for each round
	EXCHANGE_DYNAMIC_FEE_ROUNDS: '6', // dynamic fee rounds
	EXCHANGE_MAX_DYNAMIC_FEE: w3utils.toWei('0.015'), // cap max dynamic fee to 5%
	MINIMUM_STAKE_TIME: (3600 * 24).toString(), // 1 days
	DEBT_SNAPSHOT_STALE_TIME: (43800).toString(), // 12 hour heartbeat + 10 minutes mining time
	AGGREGATOR_WARNING_FLAGS: {
		mainnet: '0x72a4116ec4d7de427f57e972639a3d29af2d6e18',
		testnet: '0x771141128c59797f37ba19e21c9aa368bc0842b6',
	},
	RENBTC_ERC20_ADDRESSES: {
		mainnet: '0xfCe146bF3146100cfe5dB4129cf6C82b0eF4Ad8c',
		testnet: '0x765b1e342734fA9001C7497190BAbd8f706f47db',
		goerli: '0x9B2fE385cEDea62D839E4dE89B0A23EF4eacC717',
		mumbai: '0xCF6BC4Ae4a99C539353E4BF4C80fff296413CeeA',
		sepolia: '0x99C67FFF21329c3B0f6922b7Df00bAB8D96325c9',
	},
	WETH_ERC20_ADDRESSES: {
		mainnet: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
		testnet: '0x094616f0bdfb0b526bd735bf66eca0ad254ca81f',
		goerli: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
		mumbai: '0x4DfAe612aaCB5b448C12A591cD0879bFa2e51d62',
		sepolia: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
	},
	INITIAL_ISSUANCE: w3utils.toWei(`${100e6}`),
	CROSS_DOMAIN_DEPOSIT_GAS_LIMIT: `${3e6}`,
	CROSS_DOMAIN_ESCROW_GAS_LIMIT: `${8e6}`,
	CROSS_DOMAIN_REWARD_GAS_LIMIT: `${8e6}`,
	CROSS_DOMAIN_WITHDRAWAL_GAS_LIMIT: `${3e6}`,
	CROSS_DOMAIN_RELAY_GAS_LIMIT: `${8e6}`,
	CROSS_DOMAIN_FEE_PERIOD_CLOSE_GAS_LIMIT: `${8e6}`,

	COLLATERAL_MANAGER: {
		SYNTHS: ['zUSD', 'zBTC', 'zBNB'],
		SHORTS: ['zBTC', 'zBNB'],
		MAX_DEBT: w3utils.toWei('75000000'), // 75 million zUSD
		MAX_SKEW_RATE: w3utils.toWei('0.2'),
		BASE_BORROW_RATE: Math.round((0.005 * 1e18) / 31556926).toString(), // 31556926 is CollateralManager seconds per year
		BASE_SHORT_RATE: Math.round((0.005 * 1e18) / 31556926).toString(),
	},
	COLLATERAL_ETH: {
		SYNTHS: ['zUSD', 'zBNB'],
		MIN_CRATIO: w3utils.toWei('1.3'),
		MIN_COLLATERAL: w3utils.toWei('2'),
		ISSUE_FEE_RATE: w3utils.toWei('0.001'),
	},
	COLLATERAL_RENBTC: {
		SYNTHS: ['zUSD', 'zBTC'],
		MIN_CRATIO: w3utils.toWei('1.3'),
		MIN_COLLATERAL: w3utils.toWei('0.05'),
		ISSUE_FEE_RATE: w3utils.toWei('0.001'),
	},
	COLLATERAL_SHORT: {
		SYNTHS: ['zBTC', 'zBNB'],
		MIN_CRATIO: w3utils.toWei('1.2'),
		MIN_COLLATERAL: w3utils.toWei('1000'),
		ISSUE_FEE_RATE: w3utils.toWei('0.005'),
		INTERACTION_DELAY: '3600', // 1 hour in secs
		COLLAPSE_FEE_RATE: '0',
	},

	ETHER_WRAPPER_MAX_ETH: w3utils.toWei('0'),
	ETHER_WRAPPER_MINT_FEE_RATE: w3utils.toWei('0.005'), // 5 bps
	ETHER_WRAPPER_BURN_FEE_RATE: w3utils.toWei('0'), // 0 bps

	FUTURES_MIN_KEEPER_FEE: w3utils.toWei('0'), // 0 zUSD min keeper fee
	FUTURES_MAX_KEEPER_FEE: w3utils.toWei('1000'), // 1000 zUSD max keeper fee
	FUTURES_LIQUIDATION_FEE_RATIO: w3utils.toWei('0.0035'), // 35 basis points liquidation incentive
	FUTURES_LIQUIDATION_BUFFER_RATIO: w3utils.toWei('0.0025'), // 25 basis points liquidation buffer
	FUTURES_MIN_INITIAL_MARGIN: w3utils.toWei('40'), // minimum initial margin for all markets
	PERPSV2_KEEPER_LIQUIDATION_FEE: w3utils.toWei('1'), // 1 zUSD keeper liquidation fee (not flagger)

	// SIP-120
	ATOMIC_MAX_VOLUME_PER_BLOCK: w3utils.toWei(`${2e5}`), // 200k
	ATOMIC_TWAP_WINDOW: '1800', // 30 mins
};

/**
 * Converts a string into a hex representation of bytes32, with right padding
 */
const toBytes32 = (key) => w3utils.rightPad(w3utils.asciiToHex(key), 64);
const fromBytes32 = (key) => w3utils.hexToAscii(key);

const getFolderNameForNetwork = ({ network, useOvm = false }) => {
	if (network.includes('ovm')) {
		return network;
	}

	return useOvm ? `${network}-ovm` : network;
};

const getPathToNetwork = ({ network = 'mainnet', file = '', useOvm = false, path } = {}) =>
	path.join(__dirname, 'publish', 'deployed', getFolderNameForNetwork({ network, useOvm }), file);

// Pass in fs and path to avoid webpack wrapping those
const loadDeploymentFile = ({ network = 'mainnet', path, fs, deploymentPath, useOvm = false }) => {
	if (!deploymentPath && (!path || !fs)) {
		return data[getFolderNameForNetwork({ network, useOvm })].deployment;
	}
	const pathToDeployment = deploymentPath
		? path.join(deploymentPath, constants.DEPLOYMENT_FILENAME)
		: getPathToNetwork({ network, useOvm, path, file: constants.DEPLOYMENT_FILENAME });

	if (!fs.existsSync(pathToDeployment)) {
		throw Error(`Cannot find deployment for network: ${network}.`);
	}
	return JSON.parse(fs.readFileSync(pathToDeployment));
};

/**
 * Retrieve the list of targets for the network - returning the name, address, source file and link to etherscan
 */
const getTarget = ({
	network = 'mainnet',
	useOvm = false,
	contract,
	path,
	fs,
	deploymentPath,
} = {}) => {
	const deployment = loadDeploymentFile({ network, useOvm, path, fs, deploymentPath });
	if (contract) return deployment.targets[contract];
	else return deployment.targets;
};

/**
 * Retrieve the list of solidity sources for the network - returning the abi and bytecode
 */
const getSource = ({
	network = 'mainnet',
	useOvm = false,
	contract,
	path,
	fs,
	deploymentPath,
} = {}) => {
	const deployment = loadDeploymentFile({ network, useOvm, path, fs, deploymentPath });
	if (contract) return deployment.sources[contract];
	else return deployment.sources;
};

/**
 * Retrieve the ASTs for the source contracts
 */
const getAST = ({ source, path, fs, match = /^contracts\// } = {}) => {
	let fullAST;
	if (path && fs) {
		const pathToAST = path.resolve(
			__dirname,
			constants.BUILD_FOLDER,
			constants.AST_FOLDER,
			constants.AST_FILENAME
		);
		if (!fs.existsSync(pathToAST)) {
			throw Error('Cannot find AST');
		}
		fullAST = JSON.parse(fs.readFileSync(pathToAST));
	} else {
		// Note: The below cannot be required as the build folder is not stored
		// in code (only in the published module).
		// The solution involves tracking these after each commit in another file
		// somewhere persisted in the codebase - JJM
		// 		data.ast = require('./build/ast/asts.json'),
		if (!data.ast) {
			throw Error('AST currently not supported in browser mode');
		}
		fullAST = data.ast;
	}

	// remove anything not matching the pattern
	const ast = Object.entries(fullAST)
		.filter(([astEntryKey]) => match.test(astEntryKey))
		.reduce((memo, [key, val]) => {
			memo[key] = val;
			return memo;
		}, {});

	if (source && source in ast) {
		return ast[source];
	} else if (source) {
		// try to find the source without a path
		const [key, entry] =
			Object.entries(ast).find(([astEntryKey]) => astEntryKey.includes('/' + source)) || [];
		if (!key || !entry) {
			throw Error(`Cannot find AST entry for source: ${source}`);
		}
		return { [key]: entry };
	} else {
		return ast;
	}
};

const getFeeds = ({ network, path, fs, deploymentPath, useOvm = false } = {}) => {
	let feeds;

	if (!deploymentPath && (!path || !fs)) {
		feeds = data[getFolderNameForNetwork({ network, useOvm })].feeds;
	} else {
		const pathToFeeds = deploymentPath
			? path.join(deploymentPath, constants.FEEDS_FILENAME)
			: getPathToNetwork({
					network,
					path,
					useOvm,
					file: constants.FEEDS_FILENAME,
			  });
		if (!fs.existsSync(pathToFeeds)) {
			throw Error(`Cannot find feeds file.`);
		}
		feeds = JSON.parse(fs.readFileSync(pathToFeeds));
	}

	// now mix in the asset data
	return Object.entries(feeds).reduce((memo, [asset, entry]) => {
		memo[asset] = Object.assign(assets[asset], entry);
		return memo;
	}, {});
};

const getOffchainFeeds = ({ network, path, fs, deploymentPath, useOvm = false } = {}) => {
	if (!deploymentPath && (!path || !fs)) {
		return data[getFolderNameForNetwork({ network, useOvm })].offchainFeeds;
	} else {
		const pathToFeeds = deploymentPath
			? path.join(deploymentPath, constants.OFFCHAIN_FEEDS_FILENAME)
			: getPathToNetwork({
				network,
				path,
				useOvm,
				file: constants.OFFCHAIN_FEEDS_FILENAME,
			});
		if (!fs.existsSync(pathToFeeds)) {
			throw Error(`Cannot find off-chain feeds file.`);
		}
		return JSON.parse(fs.readFileSync(pathToFeeds));
	}
};

/**
 * Retrieve ths list of synths for the network - returning their names, assets underlying, category, sign, description, and
 * optional index and inverse properties
 */
const getSynths = ({
	network = 'mainnet',
	path,
	fs,
	deploymentPath,
	useOvm = false,
	skipPopulate = false,
} = {}) => {
	let synths;

	if (!deploymentPath && (!path || !fs)) {
		synths = data[getFolderNameForNetwork({ network, useOvm })].synths;
	} else {
		const pathToSynthList = deploymentPath
			? path.join(deploymentPath, constants.SYNTHS_FILENAME)
			: getPathToNetwork({ network, useOvm, path, file: constants.SYNTHS_FILENAME });
		if (!fs.existsSync(pathToSynthList)) {
			throw Error(`Cannot find synth list.`);
		}
		synths = JSON.parse(fs.readFileSync(pathToSynthList));
	}

	if (skipPopulate) {
		return synths;
	}

	const feeds = getFeeds({ network, useOvm, path, fs, deploymentPath });

	// copy all necessary index parameters from the longs to the corresponding shorts
	return synths.map((synth) => {
		// mixin the asset details
		synth = Object.assign({}, assets[synth.asset], synth);

		if (feeds[synth.asset]) {
			const { feed } = feeds[synth.asset];

			synth = Object.assign({ feed }, synth);
		}

		// replace an index placeholder with the index details
		if (typeof synth.index === 'string') {
			const { index } = synths.find(({ name }) => name === synth.index) || {};
			if (!index) {
				throw Error(
					`While processing ${synth.name}, it's index mapping "${synth.index}" cannot be found - this is an error in the deployment config and should be fixed`
				);
			}
			synth = Object.assign({}, synth, { index });
		}

		if (synth.index) {
			synth.index = synth.index.map((indexEntry) => {
				return Object.assign({}, assets[indexEntry.asset], indexEntry);
			});
		}

		return synth;
	});
};

const getFuturesMarkets = ({
	network = 'mainnet',
	useOvm = false,
	path,
	fs,
	deploymentPath,
} = {}) => {
	let futuresMarkets;
	if (!deploymentPath && (!path || !fs)) {
		futuresMarkets = data[getFolderNameForNetwork({ network, useOvm })].futuresMarkets;
	} else {
		const pathToFuturesMarketsList = deploymentPath
			? path.join(deploymentPath, constants.FUTURES_MARKETS_FILENAME)
			: getPathToNetwork({
					network,
					path,
					useOvm,
					file: constants.FUTURES_MARKETS_FILENAME,
			  });
		if (!fs.existsSync(pathToFuturesMarketsList)) {
			futuresMarkets = [];
		} else {
			futuresMarkets = JSON.parse(fs.readFileSync(pathToFuturesMarketsList)) || [];
		}
	}

	return futuresMarkets.map((futuresMarket) => {
		/**
		 * We expect the asset key to not start with an 's'. ie. AVAX rather than sAVAX
		 * Unfortunately due to some historical reasons 'sBTC', 'sETH' and 'sLINK' does not follow this format
		 * We adjust for that here.
		 */
		const marketsWithIncorrectAssetKey = ['zBTC', 'zETH', 'zLINK'];
		const assetKeyNeedsAdjustment = marketsWithIncorrectAssetKey.includes(futuresMarket.asset);
		const assetKey = assetKeyNeedsAdjustment ? futuresMarket.asset.slice(1) : futuresMarket.asset;
		// mixin the asset details
		return Object.assign({}, assets[assetKey], futuresMarket);
	});
};

const getPerpsMarkets = ({
	network = 'mainnet',
	useOvm = false,
	path,
	fs,
	deploymentPath,
} = {}) => {
	let perpsMarkets;

	if (!deploymentPath && (!path || !fs)) {
		perpsMarkets = data[getFolderNameForNetwork({ network, useOvm })].perpsv2Markets;
	} else {
		const pathToPerpsMarketsList = deploymentPath
			? path.join(deploymentPath, constants.PERPS_V2_MARKETS_FILENAME)
			: getPathToNetwork({
					network,
					path,
					useOvm,
					file: constants.PERPS_V2_MARKETS_FILENAME,
			  });

		if (!fs.existsSync(pathToPerpsMarketsList)) {
			perpsMarkets = [];
		} else {
			perpsMarkets = JSON.parse(fs.readFileSync(pathToPerpsMarketsList)) || [];
		}
	}
	return perpsMarkets.map(perpsMarket => {
		/**
		 * We expect the asset key to not start with an 's'. ie. AVAX rather than sAVAX
		 * Unfortunately due to some historical reasons 'sBTC' and 'sETH' does not follow this format
		 * We adjust for that here.
		 */
		const marketsWithIncorrectAssetKey = ['zBTC', 'zETH'];
		const assetKeyNeedsAdjustment = marketsWithIncorrectAssetKey.includes(perpsMarket.asset);
		const assetKey = assetKeyNeedsAdjustment ? perpsMarket.asset.slice(1) : perpsMarket.asset;
		// mixin the asset details
		return Object.assign({}, assets[assetKey], perpsMarket);
	});
};

const getPerpsV2ProxiedMarkets = ({ network = 'mainnet', fs, deploymentPath, path }) => {
	const _analyzeAndIncludePerpsV2 = (target, targetData, sourceData, PerpsV2Proxied) => {
		const proxyPrefix = 'PerpsV2Proxy';
		const marketPrefix = 'PerpsV2Market';
		const excludedContracts = ['PerpsV2MarketSettings', 'PerpsV2MarketData', 'PerpsV2ExchangeRate'];
		const excludedLegacyContracts = ['PerpsV2DelayedOrder', 'PerpsV2OffchainDelayedOrder'];
		const prefixes = [
			'PerpsV2MarketViews',
			'PerpsV2DelayedIntent',
			'PerpsV2DelayedExecution',
			'PerpsV2MarketLiquidate',
		];
		if (
			excludedContracts.includes(target) ||
			target.startsWith('PerpsV2MarketState') ||
			excludedLegacyContracts.some(prefix => target.startsWith(prefix))
		) {
			// Markets helper or Market state. Do nothing
			return;
		}

		// If is the proxy, get the address. Initialize object if not done yet
		if (target.startsWith(proxyPrefix)) {
			// get name
			const marketName = target.slice(proxyPrefix.length);
			if (!PerpsV2Proxied[marketName]) {
				PerpsV2Proxied[marketName] = {};
				PerpsV2Proxied[marketName].abi = [];
			}
			// get address
			PerpsV2Proxied[marketName].address = targetData.address;
		} else {
			// Not proxy, is one of the components. First try with the long contract names because main component prefix is included in others
			let nameFound = false;
			let marketName;

			// Identify the market name (after the prefix)
			for (const prefix of prefixes) {
				if (target.startsWith(prefix)) {
					// get name
					marketName = target.slice(prefix.length);
					nameFound = true;
				}
			}

			// if not found one the previous step, it should be PerpsV2MarketXXXXX
			if (!nameFound) {
				if (target.startsWith(marketPrefix)) {
					// get name
					marketName = target.slice(marketPrefix.length);
					nameFound = true;
				}
			}

			if (nameFound) {
				// Initialize if not done yet
				if (!PerpsV2Proxied[marketName]) {
					PerpsV2Proxied[marketName] = {};
					PerpsV2Proxied[marketName].abi = [];
				}
				// add fragments to abi
				_consolidateAbi(sourceData.abi, PerpsV2Proxied[marketName].abi);
			}
		}
	};

	const _consolidateAbi = (currentAbi, consolidatedAbi) => {
		for (const abiFragment of currentAbi) {
			if (
				!consolidatedAbi.find(
					f =>
						f.type === abiFragment.type && f.name && abiFragment.name && f.name === abiFragment.name
				)
			) {
				if (abiFragment.type !== 'constructor') {
					// don't push constructors to the consolidated abi
					consolidatedAbi.push(abiFragment);
				}
			}
		}
	};

	const deploymentData = loadDeploymentFile({ network, useOvm: false, path, fs, deploymentPath });

	const targets = Object.keys(deploymentData.targets);

	const PerpsV2Proxied = {};

	for (const target of targets) {
		if (!target.startsWith('PerpsV2')) {
			continue;
		}
		const targetData = getTarget({
			contract: target,
			network,
			useOvm: false,
			path,
			fs,
			deploymentPath,
		});

		const sourceData = getSource({
			contract: targetData.source,
			network,
			useOvm: false,
			path,
			fs,
			deploymentPath,
		});

		_analyzeAndIncludePerpsV2(target, targetData, sourceData, PerpsV2Proxied);
	}

	return PerpsV2Proxied;
};

/**
 * Retrieve the list of staking rewards for the network - returning this names, stakingToken, and rewardToken
 */
const getStakingRewards = ({
	network = 'mainnet',
	useOvm = false,
	path,
	fs,
	deploymentPath,
} = {}) => {
	if (!deploymentPath && (!path || !fs)) {
		return data[getFolderNameForNetwork({ network, useOvm })].rewards;
	}

	const pathToStakingRewardsList = deploymentPath
		? path.join(deploymentPath, constants.STAKING_REWARDS_FILENAME)
		: getPathToNetwork({
				network,
				path,
				useOvm,
				file: constants.STAKING_REWARDS_FILENAME,
		  });
	if (!fs.existsSync(pathToStakingRewardsList)) {
		return [];
	}
	return JSON.parse(fs.readFileSync(pathToStakingRewardsList));
};

/**
 * Retrieve the list of shorting rewards for the network - returning the names and rewardTokens
 */
const getShortingRewards = ({
	network = 'mainnet',
	useOvm = false,
	path,
	fs,
	deploymentPath,
} = {}) => {
	if (!deploymentPath && (!path || !fs)) {
		return data[getFolderNameForNetwork({ network, useOvm })]['shorting-rewards'];
	}

	const pathToShortingRewardsList = deploymentPath
		? path.join(deploymentPath, constants.SHORTING_REWARDS_FILENAME)
		: getPathToNetwork({
				network,
				path,
				useOvm,
				file: constants.SHORTING_REWARDS_FILENAME,
		  });
	if (!fs.existsSync(pathToShortingRewardsList)) {
		return [];
	}
	return JSON.parse(fs.readFileSync(pathToShortingRewardsList));
};

/**
 * Retrieve the list of system user addresses
 */
const getUsers = ({ network = 'mainnet', user, useOvm = false } = {}) => {
	const testnetOwner = '0xD9e11e52D2fAF7E735613CcB54478461611Fd4b7';
	const base = {
		owner: testnetOwner,
		deployer: testnetOwner,
		marketClosure: testnetOwner,
		oracle: '0xac1e8B385230970319906C03A1d8567e3996d1d5',
		fee: '0xfeEFEEfeefEeFeefEEFEEfEeFeefEEFeeFEEFEeF',
		zero: '0x' + '0'.repeat(40),
	};

	const map = {
		mainnet: Object.assign({}, base, {
			owner: '0x81752bC7D54a45bdB9005223d61D2CBd33d04857',
			deployer: '0x3a10A18Ca6d9378010D446068d2Fd4dE5D272915',
			marketClosure: '0xC105Ea57Eb434Fbe44690d7Dec2702e4a2FBFCf7',
			oracle: '0xaC1ED4Fabbd5204E02950D68b6FC8c446AC95362',
		}),
		testnet: Object.assign({}, base),
		goerli: Object.assign({}, base, {
			owner: '0xA3F3E41cc12Abf3608480d9272fca44594a0cC4B',
			// deployer: '0xD9e11e52D2fAF7E735613CcB54478461611Fd4b7',
		}),
		mumbai: Object.assign({}, base, {
			owner: '0xD9e11e52D2fAF7E735613CcB54478461611Fd4b7',
			// deployer: '0xD9e11e52D2fAF7E735613CcB54478461611Fd4b7',
		}),
		sepolia: Object.assign({}, base, {
			owner: '0xD9e11e52D2fAF7E735613CcB54478461611Fd4b7',
			// deployer: '0xD9e11e52D2fAF7E735613CcB54478461611Fd4b7',
		}),
		// local: Object.assign({}, base, {
		// 	// Deterministic account #0 when using `npx hardhat node`
		// 	owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
		// }),
		// 'local-ovm': Object.assign({}, base, {
		// 	// Deterministic account #0 when using `npx hardhat node`
		// 	owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
		// 	deployer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
		// 	oracle: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
		// }),
	};

	const users = Object.entries(map[getFolderNameForNetwork({ network, useOvm })]).map(
		([key, value]) => ({ name: key, address: value })
	);

	return user ? users.find(({ name }) => name === user) : users;
};

const getVersions = ({
	network = 'mainnet',
	path,
	fs,
	deploymentPath,
	useOvm,
	byContract = false,
} = {}) => {
	let versions;

	if (!deploymentPath && (!path || !fs)) {
		versions = data[getFolderNameForNetwork({ network, useOvm })].versions;
	} else {
		const pathToVersions = deploymentPath
			? path.join(deploymentPath, constants.VERSIONS_FILENAME)
			: getPathToNetwork({ network, useOvm, path, file: constants.VERSIONS_FILENAME });
		if (!fs.existsSync(pathToVersions)) {
			throw Error(`Cannot find versions for network.`);
		}
		versions = JSON.parse(fs.readFileSync(pathToVersions));
	}

	if (byContract) {
		// compile from the contract perspective
		return Object.values(versions).reduce(
			(memo, { tag, release, date, commit, block, contracts }) => {
				for (const [contract, contractEntry] of Object.entries(contracts)) {
					memo[contract] = memo[contract] || [];
					memo[contract].push(Object.assign({ tag, release, date, commit, block }, contractEntry));
				}
				return memo;
			},
			{}
		);
	}
	return versions;
};

const getSuspensionReasons = ({ code = undefined } = {}) => {
	const suspensionReasonMap = {
		1: 'System Upgrade',
		2: 'Market Closure',
		4: 'iZasset Reprice',
		6: 'Index Rebalance',
		55: 'Circuit Breaker (Phase one)', // https://sips.synthetix.io/SIPS/sip-55
		65: 'Decentralized Circuit Breaker (Phase two)', // https://sips.synthetix.io/SIPS/sip-65
		80: 'Futures configuration', // pausing according to deployment configuration
		231: 'Latency Breaker', // https://sips.synthetix.io/sips/sip-231/
		99999: 'Emergency',
	};

	return code ? suspensionReasonMap[code] : suspensionReasonMap;
};

/**
 * Retrieve the list of tokens used in the Synthetix protocol
 */
const getTokens = ({ network = 'mainnet', path, fs, useOvm = false } = {}) => {
	const synths = getSynths({ network, useOvm, path, fs });
	const targets = getTarget({ network, useOvm, path, fs });
	const feeds = getFeeds({ network, useOvm, path, fs });

	return [
		Object.assign(
			{
				symbol: 'HZN',
				asset: 'HZN',
				name: 'Synthetix',
				address: targets.ProxySynthetix.address,
				decimals: 18,
			},
			feeds['HZN'].feed ? { feed: feeds['HZN'].feed } : {}
		),
	].concat(
		synths
			.filter(({ category }) => category !== 'internal')
			.map((synth) => ({
				symbol: synth.name,
				asset: synth.asset,
				name: synth.description,
				address: (targets[`Proxy${synth.name}`] || {}).address,
				index: synth.index,
				decimals: 18,
				feed: synth.feed,
			}))
			.sort((a, b) => (a.symbol > b.symbol ? 1 : -1))
	);
};

const enhanceDecodedData = decoded => {
	const decodedBytes32 = p => {
		try {
			return { ascii: fromBytes32(p).replaceAll('\x00', '') };
		} catch (e) {
			return { ascii: '\\error decoding\\' };
		}
	};
	const formatDecimals = number => {
		const exp = /(\d)(?=(\d{3})+(?!\d))/g;
		const rep = '$1,';
		return number.toString().replace(exp, rep);
	};
	const decodeUint = p => {
		try {
			const value = w3utils.toBN(p);
			return {
				bp: value.div(w3utils.toBN(1e14)).toString(),
				decimal: formatDecimals(value.div(w3utils.toBN(1e18)).toString()),
				number: formatDecimals(value.toString()),
			};
		} catch (e) {
			return { ascii: '\\error decoding\\' };
		}
	};
	const enhancedParams = decoded.method.params.map(p => {
		if (p.type === 'bytes32') {
			return { ...p, enhanced: decodedBytes32(p.value) };
		}

		if (p.type === 'bytes32[]') {
			p.value = p.value.map(original => {
				return { original, enhanced: decodedBytes32(original) };
			});
		}

		if (/u?int[1-3][0-9]?./.test(p.type)) {
			return { ...p, enhanced: decodeUint(p.value) };
		}

		if (p.type === 'tuple') {
			const keys = Object.keys(p.value).filter(v => isNaN(v));
			const values = [];

			for (const key of keys) {
				if (p.value[key].startsWith('0x')) {
					if (p.value[key].length === 66) {
						values[key] = { original: p.value[key], enhanced: decodedBytes32(p.value[key]) };
						continue;
					}
					values[key] = p.value[key];
					continue;
				}

				values[key] = { original: p.value[key], enhanced: decodeUint(p.value[key]) };
			}

			p.value = values;
		}

		return p;
	});
	const enhancedMethod = { ...decoded.method, params: enhancedParams };
	return { ...decoded, method: enhancedMethod };
};

const decode = ({
	network = 'mainnet',
	fs,
	path,
	data,
	target,
	useOvm = false,
	decodeMigration = false,
	enhanceDecode = false,
} = {}) => {
	const sources = getSource({ network, path, fs, useOvm });
	for (const { abi } of Object.values(sources)) {
		abiDecoder.addABI(abi);
	}
	if (decodeMigration) {
		abiDecoder.addABI([
			{
				constant: false,
				inputs: [],
				name: 'migrate',
				outputs: [],
				payable: false,
				stateMutability: 'nonpayable',
				type: 'function',
			},
		]);
	}
	const targets = getTarget({ network, path, fs, useOvm });
	let contract;
	if (target) {
		contract = Object.values(targets).filter(
			({ address }) => address.toLowerCase() === target.toLowerCase()
		)[0].name;
	}
	const result = { method: abiDecoder.decodeMethod(data), contract };

	return enhanceDecode ? enhanceDecodedData(result) : result;
};

const wrap = ({ network, deploymentPath, fs, path, useOvm = false }) =>
	[
		'decode',
		'getAST',
		'getPathToNetwork',
		'getSource',
		'getStakingRewards',
		'getShortingRewards',
		'getFeeds',
		'getOffchainFeeds',
		'getSynths',
		'getTarget',
		'getFuturesMarkets',
		'getPerpsMarkets',
		'getPerpsV2ProxiedMarkets',
		'getTokens',
		'getUsers',
		'getVersions',
	].reduce((memo, fnc) => {
		memo[fnc] = (prop = {}) =>
			module.exports[fnc](Object.assign({ network, deploymentPath, fs, path, useOvm }, prop));
		return memo;
	}, {});

const getNextRelease = ({ useOvm }) => {
	const release = releases.releases.find(({ released, ovm }) => !released && (useOvm ? ovm : !ovm));

	return Object.assign({}, release, { releaseName: release.name.replace(/[^\w]/g, '') });
};

module.exports = {
	chainIdMapping,
	constants,
	decode,
	defaults,
	getAST,
	getNetworkFromId,
	getNextRelease,
	getPathToNetwork,
	getSource,
	getStakingRewards,
	getShortingRewards,
	getSuspensionReasons,
	getFeeds,
	getOffchainFeeds,
	getSynths,
	getFuturesMarkets,
	getPerpsMarkets,
	getPerpsV2ProxiedMarkets,
	getTarget,
	getTokens,
	getUsers,
	getVersions,
	networks,
	networkToChainId,
	toBytes32,
	fromBytes32,
	wrap,
	nonUpgradeable,
	releases,
	knownAccounts,
};
