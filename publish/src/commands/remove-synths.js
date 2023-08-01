'use strict';

const fs = require('fs');
const { gray, yellow, red, cyan, green } = require('chalk');
const ethers = require('ethers');

const {
	toBytes32,
	getUsers,
	constants: { CONFIG_FILENAME, DEPLOYMENT_FILENAME },
} = require('../../..');

const {
	ensureNetwork,
	ensureDeploymentPath,
	getDeploymentPathForNetwork,
	loadAndCheckRequiredSources,
	loadConnections,
	confirmAction,
	stringify,
} = require('../util');

const { performTransactionalStep } = require('../command-utils/transact');

const DEFAULTS = {
	network: 'goerli',
	gasLimit: 3e5,
	priorityGasPrice: '1',
};

const removeSynths = async ({
	network = DEFAULTS.network,
	deploymentPath,
	maxFeePerGas,
	maxPriorityFeePerGas = DEFAULTS.priorityGasPrice,
	gasLimit = DEFAULTS.gasLimit,
	synthsToRemove = [],
	yes,
	useFork,
	dryRun = false,
	privateKey,
}) => {
	ensureNetwork(network);
	deploymentPath = deploymentPath || getDeploymentPathForNetwork({ network });
	ensureDeploymentPath(deploymentPath);

	const {
		synths,
		synthsFile,
		deployment,
		deploymentFile,
		config,
		configFile,
		ownerActions,
		ownerActionsFile,
	} = loadAndCheckRequiredSources({
		deploymentPath,
		network,
	});

	if (synthsToRemove.length < 1) {
		console.log(gray('No synths provided. Please use --synths-to-remove option'));
		return;
	}

	// sanity-check the synth list
	for (const synth of synthsToRemove) {
		if (synths.filter(({ name }) => name === synth).length < 1) {
			console.error(red(`Zasset ${synth} not found!`));
			process.exitCode = 1;
			return;
		} else if (['zUSD'].indexOf(synth) >= 0) {
			console.error(red(`Zasset ${synth} cannot be removed`));
			process.exitCode = 1;
			return;
		}
	}

	const { providerUrl, privateKey: envPrivateKey, explorerLinkPrefix } = loadConnections({
		network,
		useFork,
	});

	// allow local deployments to use the private key passed as a CLI option
	if (network !== 'local' || !privateKey) {
		privateKey = envPrivateKey;
	}

	const provider = new ethers.providers.JsonRpcProvider(providerUrl);
	let wallet;
	if (!privateKey) {
		const account = getUsers({ network, user: 'owner' }).address; // protocolDAO
		wallet = provider.getSigner(account);
		wallet.address = await wallet.getAddress();
	} else {
		wallet = new ethers.Wallet(privateKey, provider);
	}

	console.log(gray(`Using account with public key ${wallet.address}`));
	console.log(
		gray(
			`Using max base gas of ${maxFeePerGas} GWEI, miner tip ${maxPriorityFeePerGas} GWEI with a gas limit of ${gasLimit}`
		)
	);
	console.log(gray('Dry-run:'), dryRun ? green('yes') : yellow('no'));

	if (!yes) {
		try {
			await confirmAction(
				cyan(
					`${yellow(
						'⚠ WARNING'
					)}: This action will remove the following zassets from the Synthetix contract on ${network}:\n- ${synthsToRemove.join(
						'\n- '
					)}`
				) + '\nDo you want to continue? (y/n) '
			);
		} catch (err) {
			console.log(gray('Operation cancelled'));
			return;
		}
	}

	const Synthetix = new ethers.Contract(
		deployment.targets['Synthetix'].address,
		deployment.sources['Synthetix'].abi,
		wallet
	);

	const Issuer = new ethers.Contract(
		deployment.targets['Issuer'].address,
		deployment.sources['Issuer'].abi,
		wallet
	);

	// deep clone these configurations so we can mutate and persist them
	const updatedConfig = JSON.parse(JSON.stringify(config));
	const updatedDeployment = JSON.parse(JSON.stringify(deployment));
	let updatedSynths = JSON.parse(fs.readFileSync(synthsFile));

	for (const currencyKey of synthsToRemove) {
		const { address: synthAddress, source: synthSource } = deployment.targets[
			`Zasset${currencyKey}`
		];
		const { abi: synthABI } = deployment.sources[synthSource];
		const Synth = new ethers.Contract(synthAddress, synthABI, wallet);

		const currentSynthInSNX = await Synthetix.synths(toBytes32(currencyKey));

		if (synthAddress !== currentSynthInSNX) {
			console.error(
				red(
					`Zasset address in Horizon for ${currencyKey} is different from what's deployed in Horizon to the local ${DEPLOYMENT_FILENAME} of ${network} \ndeployed: ${yellow(
						currentSynthInSNX
					)}\nlocal:    ${yellow(synthAddress)}`
				)
			);
			process.exitCode = 1;
			return;
		}

		// now check total supply (is required in Synthetix.removeSynth)
		const totalSupply = ethers.utils.formatEther(await Synth.totalSupply());
		if (Number(totalSupply) > 0) {
			console.error(
				red(
					`Cannot remove as Zasset${currencyKey}.totalSupply is non-zero: ${yellow(
						totalSupply
					)}\nThe Zasset must be purged of holders.`
				)
			);
			process.exitCode = 1;
			return;
		}

		// perform transaction if owner of Synthetix or append to owner actions list
		if (dryRun) {
			console.log(green('Would attempt to remove the zasset:', currencyKey));
		} else {
			await performTransactionalStep({
				signer: wallet,
				contract: 'Issuer',
				target: Issuer,
				write: 'removeSynth',
				writeArg: toBytes32(currencyKey),
				gasLimit,
				maxFeePerGas,
				maxPriorityFeePerGas,
				explorerLinkPrefix,
				ownerActions,
				ownerActionsFile,
				encodeABI: network === 'mainnet',
			});

			// now update the config and deployment JSON files
			const contracts = ['Proxy', 'TokenState', 'Synth'].map(name => `${name}${currencyKey}`);
			for (const contract of contracts) {
				delete updatedConfig[contract];
				delete updatedDeployment.targets[contract];
			}
			fs.writeFileSync(configFile, stringify(updatedConfig));
			fs.writeFileSync(deploymentFile, stringify(updatedDeployment));

			// and update the synths.json file
			updatedSynths = updatedSynths.filter(({ name }) => name !== currencyKey);
			fs.writeFileSync(synthsFile, stringify(updatedSynths));
		}
	}
};

module.exports = {
	removeSynths,
	cmd: program =>
		program
			.command('remove-synths')
			.description('Remove a number of synths from the system')
			.option(
				'-d, --deployment-path <value>',
				`Path to a folder that has your input configuration file ${CONFIG_FILENAME} and where your ${DEPLOYMENT_FILENAME} files will go`
			)
			.option('-g, --gas-price <value>', 'Gas price in GWEI', 1)
			.option('-l, --gas-limit <value>', 'Gas limit', 1e6)
			.option('-n, --network <value>', 'The network to run off.', x => x.toLowerCase(), 'kovan')
			.option('-r, --dry-run', 'Dry run - no changes transacted')
			.option(
				'-k, --use-fork',
				'Perform the deployment on a forked chain running on localhost (see fork command).',
				false
			)
			.option('-y, --yes', 'Dont prompt, just reply yes.')
			.option(
				'-s, --synths-to-remove <value>',
				'The list of synths to remove',
				(val, memo) => {
					memo.push(val);
					return memo;
				},
				[]
			)
			.action(removeSynths),
};
